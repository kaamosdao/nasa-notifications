import type { NoticeKind } from "./types.js";

/** Мапа префикс топика → тип события. Первое совпадение выигрывает. */
const KIND_BY_TOPIC: Array<[string, NoticeKind]> = [
  ["igwn.gwalert", "gw"],
  ["gcn.circulars", "circular"],
  ["gcn.notices.icecube", "neutrino"],
  ["gcn.classic.text.ICECUBE", "neutrino"],
  ["gcn.classic.text.AMON", "neutrino"],
  ["gcn.notices.swift", "grb"],
  ["gcn.notices.einstein_probe", "grb"],
  ["gcn.notices.svom", "grb"],
  ["gcn.classic.text.FERMI", "grb"],
  ["gcn.classic.text.SWIFT", "grb"],
  ["gcn.classic.text.INTEGRAL", "grb"],
  ["gcn.notices.chime", "frb"],
];

export const kindFromTopic = (topic: string): NoticeKind =>
  KIND_BY_TOPIC.find(([prefix]) => topic.startsWith(prefix))?.[1] ?? "unknown";

export const toFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;

  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
};

/** ISO-строка или null: даты в GCN приходят и строками, и unix-миллисекундами. */
export const toIsoDate = (value: unknown): string | null => {
  if (typeof value === "number") {
    const fromNumber = new Date(value);

    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber.toISOString();
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

/** Схлопывает текст в однострочный превью-заголовок. */
export const toTitle = (value: string, limit = 160): string => {
  const flat = value.replace(/\s+/g, " ").trim();

  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
};
