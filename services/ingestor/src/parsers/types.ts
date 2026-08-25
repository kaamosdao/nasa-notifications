export type NoticeKind =
  | "gw"
  | "grb"
  | "frb"
  | "neutrino"
  | "circular"
  | "unknown";

export type NoticeCoords = {
  ra: number;
  dec: number;
  errorRadius: number | null;
};

/** Нормализованная форма сообщения — ровно то, что уходит в таблицу notices. */
export type ParsedNotice = {
  kind: NoticeKind;
  title: string;
  summary: string | null;
  eventAt: string | null;
  coords: NoticeCoords | null;
  externalId: string | null;
  payload: unknown;
};

export type Parser = (raw: string, topic: string) => ParsedNotice;
