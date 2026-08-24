// Эталон ОПТИМИЗИРОВАННОГО серверного фетчера к Strapi (для AI-контекста).
// Показывает обрезку over-fetch: fields на коллекции и связях, MEDIA_FIELDS вместо populate: "*",
// withCount: false, клампинг пользовательского ввода. См. скилл server-data-fetching.
//
// Базовый (не оптимизированный) вариант — docs/examples/api-query/api-query.example.ts.

import { strapiClient } from "@shared/api/strapi";
import {
  MEDIA_FIELDS,
  mediaBreakpointsPopulate,
} from "@shared/api/strapi/populate";
import type { Nullable } from "@shared/types";

export type Product = {
  id: string;
  title: string;
  price: number;
  category: Nullable<string>;
};

type GetProductsOptions = {
  page?: number;
  pageSize?: number;
  status?: "draft" | "published";
};

const MAX_PAGE_SIZE = 48; // предохранитель против запроса сотен записей подделкой query

export const getProductsOptimized = async (
  options: GetProductsOptions = {},
) => {
  const { page = 1, status } = options;
  // Клампинг пользовательского ввода: pageSize из query/cookie не должен раздувать запрос.
  const pageSize = Math.min(Math.max(options.pageSize ?? 12, 1), MAX_PAGE_SIZE);

  const products = strapiClient.collection("products");

  const findOptions: Parameters<typeof products.find>[0] = {
    // 1. fields на самой коллекции — не тянем все колонки.
    fields: ["title", "slug", "price"],
    populate: {
      // 2. Медиа-компонент shared.media: только нужные поля (не populate: "*").
      image: { populate: mediaBreakpointsPopulate },
      // 3. Медиа multiple: тоже явные поля.
      gallery: { fields: MEDIA_FIELDS },
      // 4. Связь: не тянем связанную сущность целиком.
      category: { fields: ["name", "slug"] },
    },
    // 5. withCount: false — убирает лишний COUNT(*) с джойнами, если total не нужен.
    pagination: { page, pageSize, withCount: false },
    sort: ["createdAt:desc"],
  };

  if (status) {
    findOptions.status = status;
  }

  const response = await products.find(findOptions);

  // Маппинг сырого ответа в доменную модель — граница api→domain (в бою используй Zod safeParse).
  const items: Product[] = (response.data ?? []).map((entry) => ({
    id: String(entry.documentId ?? entry.id),
    title: entry.title,
    price: Number(entry.price),
    category: entry.category?.name ?? null,
  }));

  return items;
};
