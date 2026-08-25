import type { NoticeKind } from "./types";

/** Полное название типа события — заголовок карточки. */
export const NOTICE_KIND_LABELS: Record<NoticeKind, string> = {
  gw: "Гравитационная волна",
  grb: "Гамма-всплеск",
  frb: "Быстрый радиовсплеск",
  neutrino: "Нейтрино",
  circular: "Циркуляр",
  unknown: "Оповещение",
};

/** Короткая метка для бейджа. */
export const NOTICE_KIND_BADGES: Record<NoticeKind, string> = {
  gw: "GW",
  grb: "GRB",
  frb: "FRB",
  neutrino: "NU",
  circular: "CIRC",
  unknown: "GCN",
};
