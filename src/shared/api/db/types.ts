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

/** Оповещение в том виде, в каком оно уходит в браузер (SSR-пропсы, /api/notices, SSE). */
export type Notice = {
  id: string;
  topic: string;
  kind: NoticeKind;
  title: string;
  summary: string | null;
  coords: NoticeCoords | null;
  externalId: string | null;
  eventAt: string | null;
  receivedAt: string;
};

export type NoticesPage = {
  items: Notice[];
  /** Курсор для следующей страницы истории; `null` — история кончилась. */
  nextCursor: string | null;
};

export type IngestorHealth = {
  status: "ok" | "stale" | "unknown";
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  lastNoticeAt: string | null;
  /** Секунды с последнего heartbeat; `null` — воркер ещё ни разу не отметился. */
  heartbeatLagSeconds: number | null;
};
