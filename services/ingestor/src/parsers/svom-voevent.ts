import { XMLParser } from "fast-xml-parser";

import type { NoticeCoords, Parser } from "./types.js";
import { kindFromTopic, toFiniteNumber, toIsoDate, toTitle } from "./utils.js";

/**
 * SVOM публикует нотисы только в VOEvent 2.0 (XML, IVOA) — пример на
 * gcn.nasa.gov/missions/svom:
 *
 *   <What>
 *     <Param name="Instrument" value="GRM"/>
 *     <Group name="Svom_Identifiers">
 *       <Param name="Notice_Level" value="N1g"/>
 *       <Param name="Burst_Id" value="sb25020701"/>
 *   <WhereWhen> … <ISOTime>2025-02-07T07:14:06</ISOTime>
 *                 <Position2D><Value2><C1>ra</C1><C2>dec</C2></Value2><Error2Radius>…
 *
 * У GRM позиции нет — только время.
 */
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  // `voe:VOEvent` → `VOEvent`
  removeNSPrefix: true,
  // значения Param нужны строками: '01' и '6.58' не должны превращаться в числа
  parseAttributeValue: false,
  parseTagValue: false,
  isArray: (name) => name === "Param" || name === "Group",
});

type XmlParam = { name?: string; value?: string };
type XmlNode = Record<string, unknown>;

const child = (node: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>(
    (current, key) =>
      current && typeof current === "object"
        ? (current as XmlNode)[key]
        : undefined,
    node,
  );

const asArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

/** Param'ы верхнего уровня и из всех Group — одним плоским словарём (имена не пересекаются). */
const toParams = (what: unknown): Record<string, string> => {
  const params = [
    ...asArray<XmlParam>(child(what, "Param")),
    ...asArray<XmlNode>(child(what, "Group")).flatMap((group) =>
      asArray<XmlParam>(group.Param),
    ),
  ];

  return Object.fromEntries(
    params
      .filter((param) => param.name && param.value !== undefined)
      .map((param) => [param.name, param.value]),
  );
};

/** ISOTime в VOEvent — UTC без суффикса; без `Z` Node прочитал бы её как локальное время. */
const toUtcDate = (value: unknown): string | null =>
  typeof value === "string" && value.trim()
    ? toIsoDate(/(Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`)
    : null;

const toCoords = (position: unknown): NoticeCoords | null => {
  const ra = toFiniteNumber(child(position, "Value2", "C1"));
  const dec = toFiniteNumber(child(position, "Value2", "C2"));

  if (ra === null || dec === null) {
    return null;
  }

  return {
    ra,
    dec,
    errorRadius: toFiniteNumber(child(position, "Error2Radius")),
  };
};

export const parseSvomVoEvent: Parser = (raw, topic) => {
  const event = child(xml.parse(raw), "VOEvent");

  if (!event) {
    throw new Error("Не VOEvent: нет корневого элемента");
  }

  const params = toParams(child(event, "What"));
  const coords = child(
    event,
    "WhereWhen",
    "ObsDataLocation",
    "ObservationLocation",
    "AstroCoords",
  );
  const eventAt = toUtcDate(child(coords, "Time", "TimeInstant", "ISOTime"));
  const burstId = params.Burst_Id ?? null;
  const description = child(event, "How", "Description");

  return {
    kind: kindFromTopic(topic),
    title: toTitle(
      [
        `SVOM/${params.Instrument ?? "unknown"}`,
        params.Notice_Level,
        burstId && `· ${burstId}`,
      ]
        .filter(Boolean)
        .join(" "),
    ),
    summary: null,
    eventAt,
    coords: toCoords(child(coords, "Position2D")),
    // `sb25020701` — по нему циркуляры SVOM ссылаются на триггер
    externalId: burstId,
    // XML в JSON не кладём: модели чата и ленте нужны сами значения
    payload: {
      ivorn: child(event, "ivorn") ?? null,
      description: typeof description === "string" ? description : null,
      eventAt,
      params,
    },
  };
};
