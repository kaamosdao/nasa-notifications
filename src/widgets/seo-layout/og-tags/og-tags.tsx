import Head from "next/head";
import { useRouter } from "next/router";

import { APP_INFO } from "@shared/config";

import type { SeoLayoutDataType } from "../type";
import {
  buildCanonicalPath,
  getPaginationPage,
  PAGINATION_NOINDEX,
} from "./canonical";
import { mergeSeoData } from "./utils";

export const OgTags = (props: SeoLayoutDataType) => {
  // pathname — ШАБЛОН роута (`/products`), asPath — фактический URL с query.
  const { asPath, pathname } = useRouter();

  const {
    title,
    description,
    keywords,
    ogImage,
    ogImageAlt,
    ogImageWidth,
    ogImageHeight,
    siteName,
    theme,
    noindex,
    origin,
  } = mergeSeoData(props);

  // Номер страницы пагинации (null — базовая страница или маршрут без пагинации).
  const paginationPage = getPaginationPage(asPath, pathname);

  // Индексируем, только если окружение открыто (прод), страница не помечена noindex в CMS
  // и это не закрытая настройкой страница пагинации.
  const isIndexable =
    APP_INFO.APP_ALLOW_INDEXING &&
    !noindex &&
    !(PAGINATION_NOINDEX && paginationPage !== null);

  const robots = isIndexable ? "index,follow" : "noindex,nofollow";

  // Canonical сохраняет значимые параметры (например ?page=2) и отбрасывает остальные —
  // страница пагинации канонизируется САМА НА СЕБЯ, а не на базовый листинг.
  const canonical = `${origin}${buildCanonicalPath(asPath, pathname)}`;

  // Разные страницы пагинации не должны делить один заголовок.
  const pageTitle =
    paginationPage === null ? title : `${title} — страница ${paginationPage}`;

  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content={robots} />
      <meta name="theme-color" content={theme} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:alt" content={ogImageAlt} />
      <meta property="og:image:width" content={String(ogImageWidth)} />
      <meta property="og:image:height" content={String(ogImageHeight)} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta property="twitter:domain" content={APP_INFO.APP_DOMAIN || ""} />
      <meta property="twitter:url" content={canonical} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={ogImageAlt} />
      <link rel="canonical" href={canonical} />
    </Head>
  );
};

OgTags.displayName = "OgTags";
