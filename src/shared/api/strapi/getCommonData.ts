import type {
  LinkSocial,
  Organization,
  Seo,
} from "@shared/types/strapi-components";

import { CACHE_TAGS, cached } from "../cache";
import { strapiClient } from "./strapi-client";

/**
 * Глобальные данные сайта (single-type `common` в Strapi): SEO по умолчанию, соцсети, контакты.
 * Меняются редко, читаются на каждой странице — поэтому кэшируются на сервере через lru-cache
 * (см. src/shared/api/cache/: stale-while-revalidate + single-flight + устойчивость к падению CMS).
 *
 * Запись помечена тегом `common`: вебхук `/api/revalidate` сбрасывает её сразу при правке
 * моделей `common`/`contact` в CMS, не дожидаясь TTL (карта — src/shared/api/cache/tags.ts).
 */
export type CommonData = {
  seo: Seo | null;
  /** Данные организации — источник schema.org Organization, футера и страницы контактов. */
  organization: Organization | null;
  socials: LinkSocial[];
  contacts: unknown[];
};

type GetCommonDataOptions = {
  status?: "draft" | "published";
  /** В draft-режиме кэш игнорируется, чтобы редактор видел свежие данные. */
  bypassCache?: boolean;
};

/**
 * Кэш-ключ глобальных данных. Экспортируется, чтобы вебхук `/api/revalidate` мог точечно
 * сбросить его при правке single-type `common` в CMS (иначе хедер/футер живут до TTL).
 */
export const COMMON_DATA_CACHE_KEY = "common";

const fetchCommonData = async (
  status: "draft" | "published",
): Promise<CommonData> => {
  const common = strapiClient.single("common");
  const json = await common.find({
    status,
    populate: {
      seo: { populate: "*" },
      organization: { populate: "*" },
      socials: { populate: "*" },
      contacts: { populate: "*" },
    },
  });

  const raw = json.data as Record<string, unknown> | null;
  return {
    seo: (raw?.seo as Seo | undefined) ?? null,
    organization: (raw?.organization as Organization | undefined) ?? null,
    socials: (raw?.socials as LinkSocial[] | undefined) ?? [],
    contacts: (raw?.contacts as unknown[] | undefined) ?? [],
  };
};

export const getCommonData = async (
  options: GetCommonDataOptions = {},
): Promise<CommonData> => {
  const { status = "published", bypassCache = false } = options;

  // Превью (draft) не кэшируем — редактор обязан видеть правки сразу.
  if (bypassCache || status === "draft") {
    return fetchCommonData(status);
  }

  return cached(COMMON_DATA_CACHE_KEY, () => fetchCommonData("published"), {
    tags: [CACHE_TAGS.common],
  });
};
