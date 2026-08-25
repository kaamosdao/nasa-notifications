import type { NoticeCoords, Parser } from "./types.js";
import { kindFromTopic, toFiniteNumber, toTitle } from "./utils.js";

/**
 * Классические нотисы — плоский текст `KEY: value`:
 *
 *   TITLE:      GCN/FERMI NOTICE
 *   GRB_RA:     123.4560d {+08h 13m 49s} (J2000)
 *   GRB_ERROR:  5.00 [deg radius, statistical only]
 */
const toFields = (raw: string): Map<string, string> => {
  const fields = new Map<string, string>();

  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+):\s*(.*)$/);

    if (match?.[1] && !fields.has(match[1])) {
      fields.set(match[1], match[2]?.trim() ?? "");
    }
  }

  return fields;
};

/** Значения идут с хвостом единиц и комментариев: `123.4560d {...}` → 123.456. */
const toDegrees = (value: string | undefined): number | null =>
  value === undefined ? null : toFiniteNumber(value.match(/^[+-]?[\d.]+/)?.[0]);

const findBySuffix = (
  fields: Map<string, string>,
  suffix: string,
): string | undefined => {
  for (const [key, value] of fields) {
    if (key.endsWith(suffix)) {
      return value;
    }
  }

  return undefined;
};

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/**
 * `NOTICE_DATE: Tue 25 Aug 26 12:00:00 UT` — двузначный год и суффикс `UT`,
 * который `Date` не понимает, поэтому разбираем вручную.
 */
const toClassicDate = (value: string | undefined): string | null => {
  const match = value?.match(
    /(\d{1,2}) (\w{3}) (\d{2}) (\d{2}):(\d{2}):(\d{2})/,
  );

  if (!match) {
    return null;
  }

  const [, day, month, year, hours, minutes, seconds] = match;
  const monthIndex = MONTHS.indexOf((month ?? "").toLowerCase());

  if (monthIndex < 0) {
    return null;
  }

  return new Date(
    Date.UTC(
      2000 + Number(year),
      monthIndex,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
    ),
  ).toISOString();
};

const toCoords = (fields: Map<string, string>): NoticeCoords | null => {
  const ra = toDegrees(findBySuffix(fields, "_RA"));
  const dec = toDegrees(findBySuffix(fields, "_DEC"));

  if (ra === null || dec === null) {
    return null;
  }

  return { ra, dec, errorRadius: toDegrees(findBySuffix(fields, "_ERROR")) };
};

export const parseClassicText: Parser = (raw, topic) => {
  const fields = toFields(raw);
  const title = fields.get("TITLE") ?? topic;
  const trigNum = findBySuffix(fields, "TRIG_NUM") ?? fields.get("TRIGGER_NUM");

  return {
    kind: kindFromTopic(topic),
    title: toTitle(trigNum ? `${title} · trigger ${trigNum}` : title),
    summary: raw.trim() || null,
    eventAt: toClassicDate(fields.get("NOTICE_DATE")),
    coords: toCoords(fields),
    externalId: trigNum ?? null,
    payload: Object.fromEntries(fields),
  };
};
