import type { KbDocument } from "../kb/types.js";
import { pool } from "./pool.js";

export type KbChunk = { content: string; embedding: number[] };

/** Хэш, с которым документ проиндексирован в прошлый раз; null — ещё не индексировался. */
export const findDocumentHash = async (
  document: KbDocument,
): Promise<string | null> => {
  const { rows } = await pool.query<{ doc_hash: string }>(
    `select doc_hash from kb_chunks
     where source = $1 and source_id = $2 and chunk_index = 0`,
    [document.source, document.sourceId],
  );

  return rows[0]?.doc_hash ?? null;
};

/**
 * Заменяет все куски документа одной транзакцией: при правке циркуляр мог стать
 * короче, и upsert оставил бы «хвост» старых кусков. Поиск в это время видит
 * либо старую версию, либо новую — не смесь.
 */
export const replaceDocument = async (
  document: KbDocument,
  hash: string,
  chunks: KbChunk[],
) => {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      "delete from kb_chunks where source = $1 and source_id = $2",
      [document.source, document.sourceId],
    );

    for (const [index, chunk] of chunks.entries()) {
      await client.query(
        `insert into kb_chunks (
           source, source_id, chunk_index, kind, topics, event_name, title, url,
           content, published_at, embedding, doc_hash
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector, $12)`,
        [
          document.source,
          document.sourceId,
          index,
          document.kind,
          document.topics,
          document.eventName,
          document.title,
          document.url,
          chunk.content,
          document.publishedAt,
          // pgvector принимает текстовый литерал '[0.1,0.2,…]' — ровно JSON-массив
          JSON.stringify(chunk.embedding),
          hash,
        ],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

/** Удаляет статьи, файлов которых больше нет в knowledge/. */
export const pruneKnowledge = async (keepIds: string[]) => {
  const { rowCount } = await pool.query(
    "delete from kb_chunks where source = 'knowledge' and not (source_id = any($1))",
    [keepIds],
  );

  return rowCount ?? 0;
};

/** Удаляет циркуляры, выпавшие из окна индексации. */
export const pruneCircularsBefore = async (since: Date) => {
  const { rowCount } = await pool.query(
    "delete from kb_chunks where source = 'circular' and published_at < $1",
    [since],
  );

  return rowCount ?? 0;
};
