import { getPool } from "./pool";
import type { NoticeKind } from "./types";

/** Кусок базы знаний (таблица `kb_chunks`, пишет ingestor — docs/16-ai-chat.md). */
export type KbChunk = {
  id: string;
  source: "knowledge" | "circular";
  /** Номер циркуляра или slug статьи. */
  sourceId: string;
  title: string;
  url: string | null;
  content: string;
  publishedAt: string | null;
};

type KbChunkRow = {
  id: string;
  source: KbChunk["source"];
  source_id: string;
  title: string;
  url: string | null;
  content: string;
  published_at: Date | null;
};

const SELECT_FIELDS =
  "id, source, source_id, title, url, content, published_at";

const toChunk = (row: KbChunkRow): KbChunk => ({
  id: row.id,
  source: row.source,
  sourceId: row.source_id,
  title: row.title,
  url: row.url,
  content: row.content,
  publishedAt: row.published_at?.toISOString() ?? null,
});

/** pgvector принимает вектор литералом `[0.1,0.2,…]` — это ровно JSON-массив. */
const toVector = (embedding: number[] | null) =>
  embedding ? JSON.stringify(embedding) : null;

/**
 * Циркуляры о событии notice: по `event_name` (`S250206dm`, `EP250227a`) или, если notice сам
 * циркуляр, — по его номеру и событию, о котором он написан.
 *
 * Без вектора (Ollama недоступна) расстояние — null у всех строк, и порядок решает свежесть.
 */
export const findEventChunks = async ({
  externalId,
  isCircular,
  embedding,
  limit,
}: {
  externalId: string;
  isCircular: boolean;
  embedding: number[] | null;
  limit: number;
}): Promise<KbChunk[]> => {
  const circularId = isCircular ? externalId : null;

  const { rows } = await getPool().query<KbChunkRow>(
    `with names as (
       select $1::text as name
        union
       select event_name from kb_chunks
        where source = 'circular' and source_id = $2::text and event_name is not null
     )
     select ${SELECT_FIELDS}
       from kb_chunks
      where source = 'circular'
        and (event_name in (select name from names) or source_id = $2::text)
      order by embedding <=> $3::vector, published_at desc nulls last, chunk_index
      limit $4`,
    [externalId, circularId, toVector(embedding), limit],
  );

  return rows.map(toChunk);
};

/**
 * Справочные статьи к notice: по префиксу топика (`gcn.notices.svom` ⊂
 * `gcn.notices.svom.voevent.grm`), а общие статьи без топиков — по `kind`.
 */
export const findKnowledgeChunks = async ({
  topic,
  kind,
  limit,
}: {
  topic: string;
  kind: NoticeKind;
  limit: number;
}): Promise<KbChunk[]> => {
  const { rows } = await getPool().query<KbChunkRow>(
    `select ${SELECT_FIELDS}
       from kb_chunks
      where source = 'knowledge'
        and (
          exists (select 1 from unnest(topics) as prefix where starts_with($1, prefix))
          or (kind = $2 and topics = '{}')
        )
      -- статья миссии точнее общей статьи по kind
      order by topics = '{}', source_id, chunk_index
      limit $3`,
    [topic, kind, limit],
  );

  return rows.map(toChunk);
};

/**
 * Ближайшие по смыслу циркуляры (HNSW-индекс, косинусное расстояние). Точный перебор
 * здесь — ~2 с против ~20 мс.
 */
export const searchCirculars = async (
  embedding: number[],
  limit: number,
): Promise<KbChunk[]> => {
  const { rows } = await getPool().query<KbChunkRow>(
    `select ${SELECT_FIELDS}
       from kb_chunks
      where source = 'circular'
      order by embedding <=> $1::vector
      limit $2`,
    [toVector(embedding), limit],
  );

  return rows.map(toChunk);
};

/**
 * Ближайшие по смыслу справочные статьи — точным перебором. Их ~20 кусков на ~19 тыс.
 * циркуляров: HNSW-индекс отфильтровал бы статьи уже после обхода графа и вернул пусто.
 * `materialized` не даёт планировщику взять индекс.
 */
export const searchKnowledge = async (
  embedding: number[],
  limit: number,
): Promise<KbChunk[]> => {
  const { rows } = await getPool().query<KbChunkRow>(
    `with articles as materialized (
       select ${SELECT_FIELDS}, embedding from kb_chunks where source = 'knowledge'
     )
     select ${SELECT_FIELDS}
       from articles
      order by embedding <=> $1::vector
      limit $2`,
    [toVector(embedding), limit],
  );

  return rows.map(toChunk);
};
