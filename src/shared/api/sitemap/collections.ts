import type { SitemapCollection } from "./types";

/**
 * Явный реестр коллекций с публичными страницами.
 * Перекрывает конвенцию `src/pages/<…>/[slug].tsx` при совпадении uid.
 *
 * Пример:
 * `{ uid: "articles", toPath: (slug) => `/blog/${slug}` }`
 */
export const COLLECTIONS: SitemapCollection[] = [
  // { uid: "products", toPath: (slug) => `/products/${slug}` },
];
