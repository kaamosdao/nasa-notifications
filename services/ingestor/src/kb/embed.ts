import { z } from "zod";

import { config } from "../config.js";

const responseSchema = z.object({ embeddings: z.array(z.array(z.number())) });

/**
 * nomic-embed-text обучена с префиксами задачи: документы индексируются как
 * `search_document:`, вопросы пользователя — как `search_query:` (это делает фронт).
 * Без префиксов качество поиска заметно падает.
 */
const DOCUMENT_PREFIX = "search_document: ";

/** Эмбеддинги пачки текстов одним запросом к Ollama `/api/embed`. */
export const embedDocuments = async (texts: string[]): Promise<number[][]> => {
  const response = await fetch(new URL("/api/embed", config.ollama.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: config.ollama.embedModel,
      input: texts.map((text) => DOCUMENT_PREFIX + text),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama /api/embed: HTTP ${response.status} ${await response.text()}`,
    );
  }

  const { embeddings } = responseSchema.parse(await response.json());

  if (embeddings.length !== texts.length) {
    throw new Error(
      `Ollama вернула ${embeddings.length} эмбеддингов на ${texts.length} текстов`,
    );
  }

  return embeddings;
};
