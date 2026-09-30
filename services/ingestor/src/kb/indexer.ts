import { config } from "../config.js";
import { findDocumentHash, replaceDocument } from "../db/kb-chunks.js";
import { logger } from "../logger.js";
import { chunkText } from "./chunk.js";
import { embedDocuments } from "./embed.js";
import type { KbDocument } from "./types.js";

import { createHash } from "node:crypto";

/** Поднять при изменении нарезки или текста для эмбеддинга — всё переиндексируется. */
const INDEX_VERSION = 1;

/**
 * Потолок кусков на документ. Длинные циркуляры — это таблицы фотометрии на сотни
 * строк: для объяснения события хватает начала, а эмбеддинги хвоста стоили бы минуты.
 */
const MAX_CHUNKS = 20;

const documentHash = (document: KbDocument) =>
  createHash("sha256")
    .update(JSON.stringify([INDEX_VERSION, config.ollama.embedModel, document]))
    .digest("hex");

export type IndexResult = "indexed" | "unchanged";

/** Нарезка → эмбеддинги → замена кусков в kb_chunks. Неизменённый документ пропускается. */
export const indexDocument = async (
  document: KbDocument,
): Promise<IndexResult> => {
  const hash = documentHash(document);

  if ((await findDocumentHash(document)) === hash) {
    return "unchanged";
  }

  const pieces = chunkText(document.content);

  if (pieces.length > MAX_CHUNKS) {
    logger.info("Документ обрезан по числу кусков", {
      source: document.source,
      sourceId: document.sourceId,
      chunks: pieces.length,
    });
  }

  const contents = pieces.slice(0, MAX_CHUNKS);
  // заголовок к каждому куску: без него кусок из середины («We observed the field…»)
  // не знает, о каком событии речь
  const embeddings = contents.length
    ? await embedDocuments(
        contents.map((content) => `${document.title}\n\n${content}`),
      )
    : [];

  await replaceDocument(
    document,
    hash,
    contents.map((content, index) => ({
      content,
      embedding: embeddings[index] ?? [],
    })),
  );

  return "indexed";
};

let queue = Promise.resolve();

/**
 * Индексация новых циркуляров из Kafka без ожидания: лента не должна зависеть от Ollama.
 * Очередь последовательная — пачка циркуляров не превращается в залп запросов к модели.
 * Ошибка только логируется: пропущенное догонит следующий `kb:index`.
 */
export const indexInBackground = (documents: KbDocument[]) => {
  queue = queue.then(async () => {
    for (const document of documents) {
      try {
        await indexDocument(document);
      } catch (error) {
        logger.warn("Документ не проиндексирован, догонит kb:index", {
          source: document.source,
          sourceId: document.sourceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });
};
