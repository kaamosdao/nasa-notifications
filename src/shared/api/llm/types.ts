export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  system: string;
  messages: ChatMessage[];
  /** Обрыв SSE-соединения клиентом должен останавливать генерацию: иначе платим за ответ в никуда. */
  signal?: AbortSignal;
};

/** Чат-модель. Реализация выбирается `LLM_PROVIDER`, код API от неё не зависит. */
export type LlmProvider = {
  /** Текст ответа кусками по мере генерации. */
  streamChat: (request: ChatRequest) => AsyncIterable<string>;
};

/** Эмбеддинг вопроса пользователя для поиска по kb_chunks. */
export type EmbeddingProvider = {
  embedQuery: (text: string, signal?: AbortSignal) => Promise<number[]>;
};
