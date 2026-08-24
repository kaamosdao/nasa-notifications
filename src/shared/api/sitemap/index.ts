export {
  buildSitemapEntries,
  SITEMAP_CACHE_KEY,
  SITEMAP_CACHE_TTL_MS,
} from "./build-sitemap";
export { COLLECTIONS } from "./collections";
export { escapeXml, renderSitemapXml } from "./render-xml";
export { fetchNoindexStaticPaths, STATIC_PAGE_SEO } from "./static-pages";
export type { SitemapCollection, SitemapEntry } from "./types";
