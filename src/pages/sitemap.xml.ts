import type { GetServerSidePropsContext } from "next";

import { buildSitemapEntries, renderSitemapXml } from "@shared/api/sitemap";

const Sitemap = (): null => null;

export const getServerSideProps = async ({
  res,
}: GetServerSidePropsContext): Promise<{ props: Record<string, never> }> => {
  const entries = await buildSitemapEntries();

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
