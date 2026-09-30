import type { ChatRole, ChatSource } from "../model/types";

const FALLBACK_ERROR = "The assistant failed to answer. Please try again.";

type StreamChatParams = {
  noticeId: string;
  messages: { role: ChatRole; content: string }[];
  signal: AbortSignal;
  onSources: (sources: ChatSource[]) => void;
  onDelta: (text: string) => void;
};

/** Ошибка для пользователя: текст уже английский и готов к показу. */
export class ChatError extends Error {}

const readError = async (response: Response) => {
  try {
    const body = (await response.json()) as { error?: string };

    return body.error || FALLBACK_ERROR;
  } catch {
    return FALLBACK_ERROR;
  }
};

/**
 * `POST /api/chat` и разбор SSE из тела ответа. `EventSource` не подходит — он умеет
 * только GET, а история диалога уходит в теле запроса.
 *
 * @throws ChatError — ответ сервера с ошибкой; AbortError — отмена через `signal`.
 */
export const streamChat = async ({
  noticeId,
  messages,
  signal,
  onSources,
  onDelta,
}: StreamChatParams): Promise<void> => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noticeId, messages }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new ChatError(await readError(response));
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += value;

    // События разделены пустой строкой; хвост без разделителя ждёт следующего чанка
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const raw of events) {
      const event = /^event: (.+)$/m.exec(raw)?.[1];
      const data = /^data: (.*)$/m.exec(raw)?.[1];

      if (!event || data === undefined) {
        continue;
      }

      const payload = JSON.parse(data);

      switch (event) {
        case "sources":
          onSources(payload as ChatSource[]);
          break;
        case "delta":
          onDelta((payload as { text: string }).text);
          break;
        case "error":
          throw new ChatError((payload as { error: string }).error);
        case "done":
          return;
      }
    }
  }

  // Поток оборвался без `done` — сервер упал или прокси разорвал соединение
  throw new ChatError(FALLBACK_ERROR);
};
