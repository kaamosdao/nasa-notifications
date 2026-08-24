import { strapiClient } from "@shared/api/strapi/strapi-client";

import type { SitemapCollection, SitemapEntry } from "./types";

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

/**
 * Обходит все published-записи коллекции (пагинация) и строит URL по slug.
 *
 * Записи, помеченные в CMS как `seo.noindex`, в карту не попадают: страница, закрытая от
 * индексации, не должна быть в sitemap (договорённость — см. docs/14-seo.md).
 *
 * Почему фильтруем в JS, а не запросом `filters: { seo: { noindex: { $ne: true } } }`:
 * компонент `seo` у записи может отсутствовать, тогда в SQL сравнение `NULL != true` даёт
 * `NULL` — и такая запись МОЛЧА выпадет из карты. Потерять реальную страницу хуже, чем
 * оставить лишнюю, поэтому тянем один boolean и исключаем только то, что помечено явно.
 */
export async function crawlCollection(
  collection: SitemapCollection,
  origin: string,
): Promise<SitemapEntry[]> {
  const api = strapiClient.collection(collection.uid);
  const out: SitemapEntry[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const json = await api.find({
      fields: ["slug", "updatedAt"],
      // Только флаг индексации — не тянем весь SEO-компонент.
      populate: { seo: { fields: ["noindex"] } },
      pagination: { page, pageSize: PAGE_SIZE, withCount: false },
      status: "published",
    });

    const batch = (json.data ?? []) as Array<{
      slug?: string;
      updatedAt?: string;
      seo?: { noindex?: boolean | null } | null;
    }>;

    for (const item of batch) {
      if (!item.slug) continue;
      // Строгое сравнение: исключаем только явный true, но не null/undefined/отсутствие seo.
      if (item.seo?.noindex === true) continue;

      out.push({
        loc: `${origin}${collection.toPath(item.slug)}`,
        lastmod: item.updatedAt,
      });
    }

    if (batch.length < PAGE_SIZE) break;
  }

  return out;
}
