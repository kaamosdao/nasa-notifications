import type { GetServerSidePropsContext } from "next";

import { CACHE_TAGS, cached } from "@shared/api/cache";
import {
  buildSitemapEntries,
  renderSitemapXml,
  SITEMAP_CACHE_KEY,
  SITEMAP_CACHE_TTL_MS,
} from "@shared/api/sitemap";

const Sitemap = (): null => null;

export const getServerSideProps = async ({
  res,
}: GetServerSidePropsContext): Promise<{ props: Record<string, never> }> => {
  // Тег обязателен: без него вебхук (invalidateTags) не найдёт эту запись и карта будет
  // жить до конца TTL, даже когда страница появилась или исчезла в CMS.
  const entries = await cached(SITEMAP_CACHE_KEY, buildSitemapEntries, {
    ttlMs: SITEMAP_CACHE_TTL_MS,
    tags: [CACHE_TAGS.sitemap],
  });

  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=86400, stale-while-revalidate",
  );
  res.write(renderSitemapXml(entries));
  res.end();

  return { props: {} };
};

export default Sitemap;
