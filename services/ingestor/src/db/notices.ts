import { config } from "../config.js";
import type { ParsedNotice } from "../parsers/index.js";
import { pool } from "./pool.js";

export type NoticeRecord = ParsedNotice & {
  topic: string;
  partition: number;
  offset: string;
};

const COLUMNS = 12;

const toValues = (notice: NoticeRecord) => [
  notice.topic,
  notice.partition,
  notice.offset,
  notice.externalId,
  notice.kind,
  notice.title,
  notice.summary,
  notice.coords?.ra ?? null,
  notice.coords?.dec ?? null,
  notice.coords?.errorRadius ?? null,
  notice.eventAt,
  JSON.stringify(notice.payload ?? null),
];

/**
 * Вставляет пачку оповещений одним запросом и шлёт `pg_notify` по каждой реально
 * добавленной строке — дубли (`ON CONFLICT DO NOTHING`) уведомление не порождают.
 * В NOTIFY уходит только id: payload ограничен 8 КБ, строку фронт добирает SELECT'ом.
 *
 * @returns id вставленных строк
 */
export const insertNotices = async (
  notices: NoticeRecord[],
): Promise<string[]> => {
  if (!notices.length) {
    return [];
  }

  const placeholders = notices
    .map(
      (_, row) =>
        `(${Array.from({ length: COLUMNS }, (__, column) => `$${row * COLUMNS + column + 1}`).join(", ")})`,
    )
    .join(", ");

  const { rows } = await pool.query<{ id: string }>(
    `with inserted as (
       insert into notices (
         topic, kafka_partition, kafka_offset, external_id, kind, title, summary,
         ra, dec, error_radius, event_at, payload
       )
       values ${placeholders}
       on conflict (topic, kafka_partition, kafka_offset) do nothing
       returning id
     )
     select id, pg_notify('gcn_notice', id::text) from inserted`,
    notices.flatMap(toValues),
  );

  return rows.map((row) => row.id);
};

/** Liveness: heartbeat в notices не пишем, только обновляем отметку времени. */
export const touchState = async (patch: Record<string, unknown>) => {
  await pool.query(
    `insert into service_state (key, value)
     values ($1, $2::jsonb)
     on conflict (key) do update set value = service_state.value || excluded.value`,
    [config.stateKey, JSON.stringify(patch)],
  );
};
