import { siteURL } from "@shared/config";

import { COLLECTIONS } from "./collections";
import { crawlCollection } from "./crawl-collection";
import { scanPages } from "./scan-pages";
import { fetchNoindexStaticPaths } from "./static-pages";
import type { SitemapCollection, SitemapEntry } from "./types";

export const SITEMAP_CACHE_KEY = "sitemap";

/** TTL до явной инвалидации webhook'ом (год). */
export const SITEMAP_CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Реестр перекрывает конвенцию при совпадении uid.
 */
function mergeCollections(
  convention: SitemapCollection[],
  registry: SitemapCollection[],
): SitemapCollection[] {
  const byUid = new Map<string, SitemapCollection>();
  for (const c of convention) byUid.set(c.uid, c);
  for (const c of registry) byUid.set(c.uid, c);
  return [...byUid.values()];
}

/**
 * Собирает записи карты сайта: статические маршруты + published-записи коллекций.
 *
 * Страницы, помеченные в CMS `seo.noindex`, исключаются — закрытая от индексации страница
 * не должна быть в sitemap (см. docs/14-seo.md). Для коллекций флаг проверяется при обходе
 * (`crawl-collection`), для статики — по реестру `STATIC_PAGE_SEO`.
 */
export async function buildSitemapEntries(): Promise<SitemapEntry[]> {
  const origin = siteURL.origin;
  const { staticPaths, conventionCollections } = scanPages();
  const collections = mergeCollections(conventionCollections, COLLECTIONS);

  // Статика и коллекции читаются параллельно — это независимые источники.
  const [noindexStaticPaths, settled] = await Promise.all([
    fetchNoindexStaticPaths(),
    Promise.allSettled(collections.map((c) => crawlCollection(c, origin))),
  ]);

  const staticEntries: SitemapEntry[] = staticPaths
    .filter((p) => !noindexStaticPaths.has(p))
    .map((p) => ({
      loc: p === "/" ? origin : `${origin}${p}`,
    }));

  const dynamic = settled.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );

  return [...staticEntries, ...dynamic];
}
