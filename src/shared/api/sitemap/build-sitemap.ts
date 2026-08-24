import { siteURL } from "@shared/config";

import { scanPages } from "./scan-pages";
import type { SitemapEntry } from "./types";

/**
 * Собирает записи карты сайта из статических маршрутов `src/pages`.
 *
 * Динамических публичных страниц в проекте нет: лента — одна страница, события в ней
 * приходят потоком и отдельных URL не имеют. Поэтому карта строится обходом файловой
 * системы, без запросов наружу и без кэша — это дёшево.
 */
export async function buildSitemapEntries(): Promise<SitemapEntry[]> {
  const origin = siteURL.origin;
  const { staticPaths } = scanPages();

  return staticPaths.map((p) => ({
    loc: p === "/" ? origin : `${origin}${p}`,
  }));
}
