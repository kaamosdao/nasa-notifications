import { createAnthropicProvider } from "./anthropic";
import { readLlmConfig } from "./config";
import { createOllamaEmbeddingProvider, createOllamaProvider } from "./ollama";
import type { EmbeddingProvider, LlmProvider } from "./types";

/** Кэш в globalThis, как у пула БД: hot-reload в dev иначе пересоздаёт клиентов. */
const globalForLlm = globalThis as typeof globalThis & {
  __llmProvider?: LlmProvider;
  __embeddingProvider?: EmbeddingProvider;
};

export const getLlmProvider = (): LlmProvider => {
  if (!globalForLlm.__llmProvider) {
    const config = readLlmConfig();

    globalForLlm.__llmProvider =
      config.LLM_PROVIDER === "anthropic"
        ? createAnthropicProvider({
            // наличие ключа при anthropic гарантирует схема конфига
            apiKey: config.ANTHROPIC_API_KEY ?? "",
            model: config.ANTHROPIC_MODEL,
            effort: config.ANTHROPIC_EFFORT,
          })
        : createOllamaProvider({
            url: config.OLLAMA_URL,
            model: config.OLLAMA_CHAT_MODEL,
          });
  }

  return globalForLlm.__llmProvider;
};

/** Эмбеддинги — всегда Ollama: у Anthropic нет endpoint'а эмбеддингов. */
export const getEmbeddingProvider = (): EmbeddingProvider => {
  if (!globalForLlm.__embeddingProvider) {
    const config = readLlmConfig();

    globalForLlm.__embeddingProvider = createOllamaEmbeddingProvider({
      url: config.OLLAMA_URL,
      model: config.OLLAMA_EMBED_MODEL,
    });
  }

  return globalForLlm.__embeddingProvider;
};

export type {
  ChatMessage,
  ChatRequest,
  EmbeddingProvider,
  LlmProvider,
} from "./types";
