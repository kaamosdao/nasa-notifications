import type { EmbeddingProvider, LlmProvider } from "./types";

/**
 * Окно контекста модели. Дефолт Ollama меньше, чем промпт с RAG (~6k токенов):
 * лишнее Ollama молча отрезает с начала — вместе с системным промптом.
 */
const NUM_CTX = 8192;

/** Потолок длины ответа — страховка от зацикливания малой модели. */
const NUM_PREDICT = 1024;

/** Тот же префикс задачи, с которым ingestor индексирует документы (`search_document: `). */
const QUERY_PREFIX = "search_query: ";

type OllamaOptions = { url: string; model: string };

const post = async (
  url: string,
  path: string,
  body: unknown,
  signal?: AbortSignal,
) => {
  const response = await fetch(new URL(path, url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `Ollama ${path}: HTTP ${response.status} ${await response.text()}`,
    );
  }

  return response;
};

/**
 * Ollama стримит NDJSON: одна JSON-строка на кусок ответа.
 * `cancel()` в finally: если потребитель вышел раньше (abort, ошибка), закрываем
 * соединение — Ollama по обрыву прекращает генерацию.
 */
async function* readNdjson(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      buffer += decoder.decode(value, { stream: !done });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim()) {
          yield JSON.parse(line) as unknown;
        }
      }

      if (done) {
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  if (buffer.trim()) {
    yield JSON.parse(buffer) as unknown;
  }
}

type ChatChunk = {
  message?: { content?: string };
  error?: string;
};

export const createOllamaProvider = ({
  url,
  model,
}: OllamaOptions): LlmProvider => ({
  async *streamChat({ system, messages, signal }) {
    const response = await post(
      url,
      "/api/chat",
      {
        model,
        messages: [{ role: "system", content: system }, ...messages],
        stream: true,
        // qwen3 и другие reasoning-модели иначе сначала «думают» сотни токенов —
        // на CPU это десятки секунд тишины перед первым словом ответа
        think: false,
        options: { num_ctx: NUM_CTX, num_predict: NUM_PREDICT },
      },
      signal,
    );

    for await (const chunk of readNdjson(
      response.body as ReadableStream<Uint8Array>,
    )) {
      const { message, error } = chunk as ChatChunk;

      if (error) {
        throw new Error(`Ollama /api/chat: ${error}`);
      }

      if (message?.content) {
        yield message.content;
      }
    }
  },
});

export const createOllamaEmbeddingProvider = ({
  url,
  model,
}: OllamaOptions): EmbeddingProvider => ({
  embedQuery: async (text, signal) => {
    const response = await post(
      url,
      "/api/embed",
      { model, input: QUERY_PREFIX + text },
      signal,
    );
    const { embeddings } = (await response.json()) as {
      embeddings?: number[][];
    };
    const [embedding] = embeddings ?? [];

    if (!embedding) {
      throw new Error("Ollama /api/embed: пустой ответ");
    }

    return embedding;
  },
});
