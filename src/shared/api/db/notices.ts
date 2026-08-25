import { getPool } from "./pool";
import type { IngestorHealth, Notice, NoticesPage } from "./types";

type NoticeRow = {
  id: string;
  topic: string;
  kind: string;
  title: string;
  summary: string | null;
  ra: number | null;
  dec: number | null;
  error_radius: number | null;
  external_id: string | null;
  event_at: Date | null;
  received_at: Date;
};

const KINDS = new Set<Notice["kind"]>([
  "gw",
  "grb",
  "frb",
  "neutrino",
  "circular",
  "unknown",
]);

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** Поля карточки. `payload` наружу не отдаём: сырое сообщение тяжёлое и ленте не нужно. */
const SELECT_FIELDS = `
  id, topic, kind, title, summary, ra, dec, error_radius,
  external_id, event_at, received_at
`;

const toNotice = (row: NoticeRow): Notice => ({
  id: row.id,
  topic: row.topic,
  kind: KINDS.has(row.kind as Notice["kind"])
    ? (row.kind as Notice["kind"])
    : "unknown",
  title: row.title,
  summary: row.summary,
  coords:
    row.ra === null || row.dec === null
      ? null
      : { ra: row.ra, dec: row.dec, errorRadius: row.error_radius },
  externalId: row.external_id,
  eventAt: row.event_at?.toISOString() ?? null,
  receivedAt: row.received_at.toISOString(),
});

/**
 * Курсор — пара `(received_at, id)`, а не OFFSET: лента постоянно пополняется сверху,
 * и любой offset уезжает на первом же новом событии.
 */
export const encodeCursor = (notice: Notice): string =>
  `${Date.parse(notice.receivedAt)}_${notice.id}`;

const decodeCursor = (cursor: string): [Date, string] | null => {
  const match = /^(\d+)_(\d+)$/.exec(cursor);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return [new Date(Number(match[1])), match[2]];
};

export const clampLimit = (value: unknown): number => {
  const limit = Number(value);

  if (!Number.isFinite(limit) || limit < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.trunc(limit), MAX_LIMIT);
};

/**
 * Страница истории — от новых к старым. `before` берётся из `nextCursor` предыдущей страницы.
 *
 * @throws если курсор не разбирается — это ошибка клиента, а не пустая страница.
 */
export const getNotices = async ({
  before,
  limit = DEFAULT_LIMIT,
}: {
  before?: string | null;
  limit?: number;
} = {}): Promise<NoticesPage> => {
  const cursor = before ? decodeCursor(before) : null;

  if (before && !cursor) {
    throw new Error(`Некорректный курсор: ${before}`);
  }

  const { rows } = await getPool().query<NoticeRow>(
    `select ${SELECT_FIELDS}
       from notices
      where $1::timestamptz is null
         or (received_at, id) < ($1::timestamptz, $2::bigint)
      order by received_at desc, id desc
      limit $3`,
    [cursor?.[0] ?? null, cursor?.[1] ?? null, limit],
  );

  const items = rows.map(toNotice);
  const last = items.at(-1);

  return {
    items,
    // Страница короче лимита — дальше история кончилась, сентинел можно не дёргать.
    nextCursor: last && items.length === limit ? encodeCursor(last) : null,
  };
};

/** Добор строки по id из NOTIFY: в уведомлении приходит только идентификатор. */
export const getNoticeById = async (id: string): Promise<Notice | null> => {
  const { rows } = await getPool().query<NoticeRow>(
    `select ${SELECT_FIELDS} from notices where id = $1::bigint`,
    [id],
  );

  return rows[0] ? toNotice(rows[0]) : null;
};

/**
 * Всё, что появилось после указанного id, — от старых к новым.
 *
 * Нужно для `Last-Event-ID`: при реконнекте SSE браузер присылает id последнего полученного
 * события, и пропуск за время обрыва нужно доиграть, иначе в ленте будет дыра.
 */
export const getNoticesAfter = async (
  id: string,
  limit = MAX_LIMIT,
): Promise<Notice[]> => {
  const { rows } = await getPool().query<NoticeRow>(
    `select ${SELECT_FIELDS}
       from notices
      where id > $1::bigint
      order by id asc
      limit $2`,
    [id, limit],
  );

  return rows.map(toNotice);
};

/** Heartbeat старше этого порога считаем протухшим: ingestor тикает раз в ~30 с. */
const STALE_AFTER_SECONDS = 120;

export const getIngestorHealth = async (): Promise<IngestorHealth> => {
  const { rows } = await getPool().query<{
    value: Record<string, string | undefined>;
  }>(`select value from service_state where key = 'ingestor'`);

  const state = rows[0]?.value ?? {};
  const lastHeartbeatAt = state.lastHeartbeatAt ?? null;
  const lagSeconds = lastHeartbeatAt
    ? Math.max(0, Math.round((Date.now() - Date.parse(lastHeartbeatAt)) / 1000))
    : null;

  return {
    status:
      lagSeconds === null
        ? "unknown"
        : lagSeconds > STALE_AFTER_SECONDS
          ? "stale"
          : "ok",
    startedAt: state.startedAt ?? null,
    lastHeartbeatAt,
    lastNoticeAt: state.lastNoticeAt ?? null,
    heartbeatLagSeconds: lagSeconds,
  };
};
