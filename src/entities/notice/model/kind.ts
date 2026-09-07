import type { NoticeKind } from "./types";

/** Полное название типа события — заголовок карточки. */
export const NOTICE_KIND_LABELS: Record<NoticeKind, string> = {
  gw: "Gravitational wave",
  grb: "Gamma-ray burst",
  frb: "Fast radio burst",
  neutrino: "Neutrino",
  circular: "Circular",
  unknown: "Alert",
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
