import { logger } from "../logger.js";
import { parseClassicText } from "./classic-text.js";
import { parseFallback, parseGenericJson } from "./generic.js";
import { parseCircular, parseGwAlert } from "./gw-alert.js";
import type { Parser } from "./types.js";

/** topic → parser. Порядок важен: первое совпадение по префиксу выигрывает. */
const PARSERS: Array<[string, Parser]> = [
  ["igwn.gwalert", parseGwAlert],
  ["gcn.circulars", parseCircular],
  ["gcn.classic.text.", parseClassicText],
];

const resolveParser = (topic: string): Parser =>
  PARSERS.find(([prefix]) => topic.startsWith(prefix))?.[1] ?? parseGenericJson;

/**
 * Разбирает сообщение выбранным парсером и **гарантированно** возвращает результат:
 * любая ошибка (не тот формат, битый JSON, новая схема) уводит сообщение в fallback.
 */
export const parseNotice = (raw: string, topic: string) => {
  try {
    return resolveParser(topic)(raw, topic);
  } catch (error) {
    logger.warn("Парсер не справился, уходим в fallback", {
      topic,
      error: error instanceof Error ? error.message : String(error),
    });

    return parseFallback(raw, topic);
  }
};

export type { NoticeKind, ParsedNotice } from "./types.js";
