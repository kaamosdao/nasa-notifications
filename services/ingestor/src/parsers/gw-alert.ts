import type { Parser } from "./types.js";
import { toFiniteNumber, toIsoDate, toTitle } from "./utils.js";

type ClassificationEntry = [string, number];

const formatFar = (far: number | null): string | null => {
  if (far === null || far <= 0) {
    return null;
  }

  // FAR приходит в Гц; человеку понятнее «раз в N лет».
  const perYear = far * 60 * 60 * 24 * 365.25;

  return perYear >= 1
    ? `FAR ≈ ${perYear.toFixed(2)}/год`
    : `FAR ≈ 1 раз в ${Math.round(1 / perYear).toLocaleString("ru-RU")} лет`;
};

const formatClassification = (classification: unknown): string | null => {
  if (!classification || typeof classification !== "object") {
    return null;
  }

  const entries = Object.entries(classification)
    .map(
      ([label, value]): ClassificationEntry => [
        label,
        toFiniteNumber(value) ?? 0,
      ],
    )
    .filter(([, probability]) => probability >= 0.01)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    return null;
  }

  return entries
    .map(([label, probability]) => `${label} ${Math.round(probability * 100)}%`)
    .join(" · ");
};

/**
 * igwn.gwalert — гравитационные волны, самый содержательный формат.
 * ⚠️ `event.skymap` вырезаем: это base64-FITS в несколько мегабайт на сообщение.
 */
export const parseGwAlert: Parser = (raw) => {
  const data = JSON.parse(raw) as Record<string, unknown>;
  const event = (data.event ?? null) as Record<string, unknown> | null;
  const { skymap: _skymap, ...eventRest } = event ?? {};

  const supereventId =
    typeof data.superevent_id === "string" ? data.superevent_id : null;
  const alertType =
    typeof data.alert_type === "string" ? data.alert_type : "UPDATE";
  const summary = [
    formatClassification(event?.classification),
    formatFar(toFiniteNumber(event?.far)),
    Array.isArray(event?.instruments)
      ? `Детекторы: ${event.instruments.join(", ")}`
      : null,
    event?.significant === false ? "Событие не значимое" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    kind: "gw",
    title: `${supereventId ?? "GW alert"} · ${alertType.toLowerCase()}`,
    summary: summary || null,
    eventAt: toIsoDate(event?.time) ?? toIsoDate(data.time_created),
    coords: null,
    externalId: supereventId,
    payload: { ...data, event: event ? eventRest : null },
  };
};

/** gcn.circulars — текстовые циркуляры: длинное тело, на фронте нужен collapse. */
export const parseCircular: Parser = (raw) => {
  const data = JSON.parse(raw) as Record<string, unknown>;
  const subject =
    typeof data.subject === "string" ? data.subject : "GCN Circular";
  const body = typeof data.body === "string" ? data.body : null;
  const circularId = data.circularId ?? data.circular_id ?? null;

  return {
    kind: "circular",
    title: toTitle(subject),
    summary: body,
    eventAt: toIsoDate(data.createdOn ?? data.created_on),
    coords: null,
    externalId: circularId === null ? null : String(circularId),
    payload: data,
  };
};
