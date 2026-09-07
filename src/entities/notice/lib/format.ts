import type { NoticeCoords } from "../model/types";

/**
 * Время только в UTC и только через явный `timeZone`: иначе сервер отформатирует по
 * таймзоне контейнера, браузер — по своей, и гидратация разъедется. Астрономические
 * данные в UTC и по существу.
 */
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export const formatNoticeTime = (iso: string): string =>
  `${timeFormatter.format(new Date(iso))} UTC`;

export const formatNoticeDate = (iso: string): string =>
  dateFormatter.format(new Date(iso));

export const formatNoticeCoords = (
  coords: NoticeCoords | null,
): string | null => {
  if (!coords) {
    return null;
  }

  const base = `RA ${coords.ra.toFixed(2)}° · Dec ${coords.dec.toFixed(2)}°`;

  return coords.errorRadius === null
    ? base
    : `${base} · ±${coords.errorRadius.toFixed(2)}°`;
};
