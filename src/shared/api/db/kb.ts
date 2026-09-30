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
 * Идентификатор триггера, который стоит искать в тексте циркуляров: номер Fermi/Swift
 * (`812212345`), id EP (`01708973486`), SVOM (`sb24022203`). Короткие и без цифр дают ложные
 * совпадения; символы — только те, что безопасно подставить в регулярку `\m…\M`.
 */
const TRIGGER_ID = /^(?=.*\d)\w{6,}$/;

/**
 * Циркуляры о событии notice. Имя события берётся так:
 * 1. `event_name = externalId` — у LVK (`S250206dm`) и IceCube LVK это одно и то же;
 * 2. notice-циркуляр — событие, о котором он написан;
 * 3. иначе (у GRB-нотисов externalId — номер триггера, а циркуляры называются `GRB 250706A`)
 *    — события циркуляров, упоминающих триггер в заголовке или первом куске, в окне
 *    от 2 суток до события до 30 после. Только если п. 1 ничего не нашёл: в циркулярах
 *    про GRB упоминают и гравволновые суперсобытия, и чужое событие подмешалось бы к LVK.
 *
 * Без вектора (Ollama недоступна) расстояние — null у всех строк, и порядок решает свежесть.
 */
export const findEventChunks = async ({
  externalId,
  isCircular,
  eventAt,
  embedding,
  limit,
}: {
  externalId: string;
  isCircular: boolean;
  /** Время события (или получения notice) — центр окна поиска упоминаний триггера. */
  eventAt: string;
  embedding: number[] | null;
  limit: number;
}): Promise<KbChunk[]> => {
  const circularId = isCircular ? externalId : null;
  const triggerId =
    !isCircular && TRIGGER_ID.test(externalId) ? externalId : null;

  const { rows } = await getPool().query<KbChunkRow>(
    `with names as (
       select $1::text as name
        union
       select event_name from kb_chunks
        where source = 'circular' and source_id = $2::text and event_name is not null
        union
       select event_name from kb_chunks
        where $3::text is not null
          and not exists (select 1 from kb_chunks where event_name = $1::text)
          and source = 'circular'
          and chunk_index = 0
          and event_name is not null
          and published_at between $4::timestamptz - interval '2 days'
                               and $4::timestamptz + interval '30 days'
          and (title || ' ' || content) ~ ('\\m' || $3::text || '\\M')
     )
     select ${SELECT_FIELDS}
       from kb_chunks
      where source = 'circular'
        and (event_name in (select name from names) or source_id = $2::text)
      order by embedding <=> $5::vector, published_at desc nulls last, chunk_index
      limit $6`,
    [externalId, circularId, triggerId, eventAt, toVector(embedding), limit],
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
