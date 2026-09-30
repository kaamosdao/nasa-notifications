import {
  findEventChunks,
  findKnowledgeChunks,
  type KbChunk,
  type Notice,
  searchCirculars,
  searchKnowledge,
} from "@shared/api/db";
import { getEmbeddingProvider } from "@shared/api/llm";

/** Сколько кусков берёт каждый канал поиска. Кусок — до ~1500 символов. */
const EVENT_LIMIT = 4;
const KNOWLEDGE_LIMIT = 3;
const SIMILAR_LIMIT = 2;

/**
 * Потолок контекста в символах (~3.5k токенов): вместе с промптом, notice и историей
 * должен влезть в окно Ollama (`num_ctx` 8192).
 */
const CONTEXT_BUDGET = 14_000;

/**
 * Эмбеддинг вопроса. Ollama недоступна — чат не падает: поиск деградирует до циркуляров
 * события и справки по kind. Обрыв клиентом — пробрасываем, дальше работать незачем.
 */
const embedQuestion = async (text: string, signal: AbortSignal) => {
  try {
    return await getEmbeddingProvider().embedQuery(text, signal);
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    console.warn("[chat] эмбеддинг недоступен, поиск без векторов:", error);

    return null;
  }
};

/**
 * Гибридный поиск, порядок каналов = приоритет при обрезке по бюджету:
 * 1. циркуляры о самом событии;
 * 2. справка по миссии/kind;
 * 3. ближайшие по смыслу статьи и циркуляры — раздельно: в общем поиске циркуляры о чужих
 *    событиях вытесняют статьи даже на вопросах о понятиях («what is a kilonova»).
 */
export const retrieveContext = async ({
  notice,
  question,
  signal,
}: {
  notice: Notice;
  question: string;
  signal: AbortSignal;
}): Promise<KbChunk[]> => {
  // Вопросы-подсказки («What is this?») сами по себе бессодержательны — ищем в паре с notice
  const embedding = await embedQuestion(`${notice.title}\n${question}`, signal);

  const channels = await Promise.all([
    notice.externalId
      ? findEventChunks({
          externalId: notice.externalId,
          isCircular: notice.kind === "circular",
          eventAt: notice.eventAt ?? notice.receivedAt,
          embedding,
          limit: EVENT_LIMIT,
        })
      : [],
    findKnowledgeChunks({
      topic: notice.topic,
      kind: notice.kind,
      limit: KNOWLEDGE_LIMIT,
    }),
    embedding ? searchKnowledge(embedding, SIMILAR_LIMIT) : [],
    embedding ? searchCirculars(embedding, SIMILAR_LIMIT) : [],
  ]);

  const seen = new Set<string>();
  const chunks: KbChunk[] = [];
  let size = 0;

  for (const chunk of channels.flat()) {
    if (seen.has(chunk.id) || size + chunk.content.length > CONTEXT_BUDGET) {
      continue;
    }

    seen.add(chunk.id);
    chunks.push(chunk);
    size += chunk.content.length;
  }

  return chunks;
};
