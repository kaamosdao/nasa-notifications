import { APP_INFO } from "@shared/config";

import type { SeoLayoutDataType } from "../type";

const isEmpty = (value?: string | null): boolean => {
  return !value || value.trim() === "";
};

/**
 * Делает URL абсолютным. OG-картинка обязана быть абсолютным публичным URL — соцсети и
 * мессенджеры не резолвят относительные пути (`/og.png`, `/uploads/...`) и ломают карточку.
 * Абсолютные URL (`http(s)://`, `//cdn...`, `data:`) возвращаются как есть.
 */
const toAbsoluteUrl = (url: string, origin: string): string => {
  if (!url) return url;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:")) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
};

export const mergeSeoData = ({
  commonSeoData,
  pageSeoData,
}: SeoLayoutDataType) => {
  const baseTitle = commonSeoData?.title;
  const baseDescription = commonSeoData?.description;
  const baseKeywords = commonSeoData?.keywords;
  const baseOgImage = commonSeoData?.ogImage;
  const baseTheme = commonSeoData?.theme;
  let mergedTitle: string;

  if (pageSeoData && !isEmpty(pageSeoData.title)) {
    if (pageSeoData.title === baseTitle) {
      mergedTitle = pageSeoData.title || "";
    } else {
      mergedTitle = `${pageSeoData.title}${baseTitle ? ` | ${baseTitle}` : ""}`;
    }
  } else {
    mergedTitle = baseTitle || "";
  }

  if (isEmpty(mergedTitle)) {
    mergedTitle = APP_INFO.APP_DEFAULT_TITLE;
  }

  const mergedDescription =
    pageSeoData && !isEmpty(pageSeoData.description)
      ? pageSeoData.description
      : baseDescription || APP_INFO.APP_DESCRIPTION;

  const mergedKeywords =
    (pageSeoData && !isEmpty(pageSeoData.keywords)
      ? pageSeoData.keywords
      : baseKeywords) || APP_INFO.APP_KEYWORDS;

  const origin = APP_INFO.APP_SITE_URL_ORIGIN;

  // Fallback-цепочка картинки: собственная картинка страницы → сущность/глобальная OG → дефолт сборки.
  // Берём объект-победитель целиком (нужны его alt/width/height), затем URL абсолютизируем.
  const winningOgImage = pageSeoData?.ogImage?.url
    ? pageSeoData.ogImage
    : baseOgImage?.url
      ? baseOgImage
      : null;

  const mergedOgImage = toAbsoluteUrl(
    winningOgImage?.url || APP_INFO.APP_DEFAULT_OG,
    origin,
  );

  // alt для og:image: собственный alt картинки → заголовок страницы (не оставляем пустым).
  const mergedOgImageAlt = winningOgImage?.alternativeText || mergedTitle;

  // Размеры og:image: из самой картинки, иначе базовый формат 1200x630 (1.91:1) для дефолтной OG.
  const mergedOgImageWidth = winningOgImage?.width ?? 1200;
  const mergedOgImageHeight = winningOgImage?.height ?? 630;

  const mergedTheme =
    pageSeoData && !isEmpty(pageSeoData.theme)
      ? pageSeoData.theme
      : baseTheme || APP_INFO.APP_DEFAULT_THEME;

  // og:site_name — имя бренда/сайта, а не заголовок страницы: глобальный SEO-title → дефолт → домен.
  const siteName =
    baseTitle || APP_INFO.APP_DEFAULT_TITLE || APP_INFO.APP_DOMAIN || "";

  // noindex: собственный флаг страницы → глобальный. Пустой прод-контент не должен молча индексироваться.
  const noindex = Boolean(
    pageSeoData?.noindex ?? commonSeoData?.noindex ?? false,
  );

  return {
    title: mergedTitle,
    description: mergedDescription,
    keywords: mergedKeywords,
    ogImage: mergedOgImage,
    ogImageAlt: mergedOgImageAlt,
    ogImageWidth: mergedOgImageWidth,
    ogImageHeight: mergedOgImageHeight,
    siteName,
    theme: mergedTheme,
    noindex,
    origin,
  };
};
