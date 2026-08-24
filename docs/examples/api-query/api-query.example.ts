// Эталонный типизированный запрос к Strapi (для AI-контекста).
// Живой аналог: src/_pages/home/api/getHomePage.ts
//
// Модель данных проекта (важно понимать):
//  - Запросы к CMS живут в сегменте api/ слайса (_pages/<page>/api, entities/<entity>/api)
//    или в src/shared/api/strapi для общих.
//  - Используется официальный SDK @strapi/client (strapiClient), а НЕ ручной axios для CMS.
//    strapiClient создаётся один раз в src/shared/api/strapi/strapi-client.ts.
//  - Запросы вызываются на СЕРВЕРЕ из getServerSideProps роутов src/pages/* и
//    оркестрируются через getServerSidePropsData. RSC в проекте нет (Pages Router).
//  - Тип опций запроса выводим из SDK: `Parameters<typeof resource.find>[0]` — не пишем руками.
//
// ВАЖНО: SDK возвращает слабо типизированный data. Доменный тип на выходе задаём вручную
// (Nullable / доменная модель) и приводим на границе api→ui. Автогенерённые типы Strapi
// (@strapi/types/generated) на фронт НЕ подключены — контракт держится на ручном типе.

import { strapiClient } from "@shared/api/strapi";
import type { Nullable } from "@shared/types";

/** Доменная модель товара (то, чем оперирует UI) — сознательно уже сырого CMS-ответа. */
export type Product = {
  id: string;
  title: string;
  price: number;
  description: Nullable<string>;
};

type GetProductsOptions = {
  page?: number;
  pageSize?: number;
  status?: "draft" | "published";
};

/**
 * Список товаров (collectionType) с пагинацией и populate.
 * Вызывать на сервере (getServerSideProps), не в клиентском компоненте.
 */
export const getProducts = async (options: GetProductsOptions = {}) => {
  const { page = 1, pageSize = 12, status } = options;
  const products = strapiClient.collection("products");

  // Тип опций берём из самого SDK — так populate/pagination/status остаются типобезопасными.
  const findOptions: Parameters<typeof products.find>[0] = {
    populate: {
      image: { populate: "*" },
      gallery: { populate: "*" },
    },
    pagination: { page, pageSize },
    sort: ["createdAt:desc"],
  };

  if (status) {
    findOptions.status = status; // draft mode
  }

  const response = await products.find(findOptions);

  // Маппинг сырого ответа в доменную модель — граница api→domain.
  const items: Product[] = response.data.map((entry) => ({
    id: String(entry.documentId ?? entry.id),
    title: entry.title,
    price: Number(entry.price),
    description: entry.description ?? null,
  }));

  return {
    items,
    pagination: response.meta.pagination, // { page, pageSize, pageCount, total }
  };
};
