import Head from "next/head";
import { useRouter } from "next/router";

import { APP_INFO } from "@shared/config";
import type { LinkSocial, Organization } from "@shared/types/seo";

import { buildCanonicalPath } from "../og-tags/canonical";
import { mergeSeoData } from "../og-tags/utils";
import type { SeoLayoutDataType } from "../type";
import { buildSchemaGraph } from "./build-schema";

export type LdJsonProps = SeoLayoutDataType & {
  /** Блок организации из глобальных данных — источник schema.org `Organization`. */
  organization?: Organization | null;
  /** Соцсети из глобальных данных — источник `sameAs`. */
  socials?: LinkSocial[];
};

/**
 * Разбирает ручной `structuredData` из CMS.
 *
 * Поле допускает и строку, и готовый объект,
 * поэтому её нельзя пробрасывать в разметку как есть: битый JSON, отданный молча, хуже
 * отсутствующего — валидатор ругается, а никто об этом не узнает.
 */
const parseManual = (data: unknown): unknown => {
  if (!data) return null;

  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed) return null;

    try {
      return JSON.parse(trimmed);
    } catch {
      console.warn(
        "[LdJson] structuredData не является валидным JSON — разметка не выведена",
      );
      return null;
    }
  }

  return data;
};

/**
 * Сериализует граф для вставки в `<script>`.
 *
 * Замена `<` на юникод-escape (см. `.replace`) — валидный JSON: парсер декодирует его обратно,
 * значение не меняется, но `</script>` внутри строки уже не может закрыть тег и подставить
 * произвольный HTML.
 */
const serialize = (value: unknown): string | null => {
  try {
    return JSON.stringify(value).replace(/</g, "\\u003c");
  } catch (error) {
    console.warn("[LdJson] не удалось сериализовать разметку:", error);
    return null;
  }
};

export const LdJson = ({
  pageSeoData,
  commonSeoData,
  organization = null,
  socials = [],
}: LdJsonProps) => {
  const { asPath, pathname } = useRouter();

  const { title, description, siteName, origin } = mergeSeoData({
    commonSeoData,
    pageSeoData,
  });

  // Тот же путь, что уходит в canonical — разметка не должна ссылаться на другой адрес.
  const path = buildCanonicalPath(asPath, pathname).split("?")[0];

  const graph = buildSchemaGraph({
    origin: origin || APP_INFO.APP_SITE_URL_ORIGIN,
    siteName,
    description,
    organization,
    socials,
    path,
    // Для крошек нужен заголовок самой страницы, а не склейка «Страница | Сайт».
    pageTitle: pageSeoData?.title || title,
    manual: parseManual(
      pageSeoData?.structuredData || commonSeoData?.structuredData,
    ),
  });

  if (!graph) return null;

  const structuredData = serialize(graph);
  if (!structuredData) return null;

  return (
    <Head>
      <script
        type="application/ld+json"
        // Содержимое прошло JSON.stringify и экранирование `<`, разорвать script-тег им нельзя.
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD по спецификации выводится текстом внутри <script>
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
    </Head>
  );
};
