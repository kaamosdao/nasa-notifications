import type { NoticeCoords, Parser } from "./types.js";
import { kindFromTopic, toFiniteNumber, toIsoDate, toTitle } from "./utils.js";

const COORD_KEYS = [
  ["ra", "dec"],
  ["RA", "DEC"],
  ["ra_deg", "dec_deg"],
] as const;

const ERROR_KEYS = ["ra_dec_error", "error_radius", "radius", "err"];
const ID_KEYS = [
  "id",
  "trigger_id",
  "burst_id",
  "event_id",
  "alert_id",
  "instrument",
];
const TIME_KEYS = [
  "trigger_time",
  "alert_datetime",
  "time",
  "datetime",
  "created_on",
];
const TITLE_KEYS = ["title", "subject", "alert_type", "notice_type", "mission"];

/** Ищет ключ на верхнем уровне и внутри вложенного `event` — GCN кладёт данные и туда, и туда. */
const pick = (
  data: Record<string, unknown>,
  keys: readonly string[],
): unknown => {
  const nested = (data.event ?? null) as Record<string, unknown> | null;

  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) {
      return data[key];
    }

    if (nested?.[key] !== undefined && nested?.[key] !== null) {
      return nested[key];
    }
  }

  return undefined;
};

const toCoords = (data: Record<string, unknown>): NoticeCoords | null => {
  for (const [raKey, decKey] of COORD_KEYS) {
    const ra = toFiniteNumber(pick(data, [raKey]));
    const dec = toFiniteNumber(pick(data, [decKey]));

    if (ra !== null && dec !== null) {
      return { ra, dec, errorRadius: toFiniteNumber(pick(data, ERROR_KEYS)) };
    }
  }

  return null;
};

/** JSON-нотисы без выделенного парсера: тянем координаты, время и идентификатор эвристикой. */
export const parseGenericJson: Parser = (raw, topic) => {
  const data = JSON.parse(raw) as Record<string, unknown>;
  const titleSource = pick(data, TITLE_KEYS);
  const externalId = pick(data, ID_KEYS);

  return {
    kind: kindFromTopic(topic),
    title: toTitle(
      typeof titleSource === "string" ? `${topic} · ${titleSource}` : topic,
    ),
    summary: null,
    eventAt: toIsoDate(pick(data, TIME_KEYS)),
    coords: toCoords(data),
    externalId: typeof externalId === "string" ? externalId : null,
    payload: data,
  };
};

/**
 * Последний рубеж: формат неизвестен и не JSON. Кладём сырой текст в summary и
 * помечаем `unknown` — незнакомое сообщение не должно ронять ни воркер, ни ленту.
 */
export const parseFallback: Parser = (raw, topic) => ({
  kind: "unknown",
  title: toTitle(raw || topic),
  summary: raw.trim() || null,
  eventAt: null,
  coords: null,
  externalId: null,
  payload: { raw, topic },
});
