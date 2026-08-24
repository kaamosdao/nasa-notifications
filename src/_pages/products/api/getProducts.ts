import { strapiClient } from "@shared/api/strapi";
import { mediaBreakpointsPopulate } from "@shared/api/strapi/populate";

import { type ProductCard, ProductsListSchema } from "../model/schemas";

type GetProductsOptions = {
  page?: number;
  pageSize?: number;
  status?: "draft" | "published";
};

export type ProductsListResult = {
  items: ProductCard[];
  page: number;
  hasNext: boolean;
};

const DEFAULT_PAGE_SIZE = 24;

/** Предохранитель от `?page=999999` — такой запрос не должен уходить в CMS. */
const MAX_PAGE = 1000;

/**
 * Номер страницы из query.
 *
 * Принимает только положительное целое, всё остальное (`?page=abc`, `?page=-5`, `?page[]=1`)
 * схлопывается в первую страницу: параметр приходит от пользователя и ему нельзя доверять.
 */
export const parsePageParam = (value: unknown): number => {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;

  if (!Number.isFinite(page) || page < 1) return 1;

  return Math.min(page, MAX_PAGE);
};

/**
 * Список published-товаров (лёгкий populate только image + fields для карточки).
 *
 * Возвращает признак наличия следующей страницы, чтобы UI мог отрисовать ссылки пагинации.
 * Ссылки обязаны быть настоящими `<a href>` — иначе бот не обойдёт глубокие страницы, каким бы
 * правильным ни был canonical.
 */
export const getProducts = async (
  options: GetProductsOptions = {},
): Promise<ProductsListResult> => {
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, status } = options;
  const products = strapiClient.collection("products");

  const findOptions: Parameters<typeof products.find>[0] = {
    fields: ["title", "slug", "price"],
    populate: {
      image: { populate: mediaBreakpointsPopulate },
    },
    // Запрашиваем на одну запись больше: наличие «лишней» означает, что есть следующая
    // страница. Дешевле, чем `withCount: true` — тот добавляет COUNT(*) с джойнами.
    pagination: { page, pageSize: pageSize + 1, withCount: false },
    sort: ["createdAt:desc"],
  };

  if (status) {
    findOptions.status = status;
  }

  const json = await products.find(findOptions);
  const parsed = ProductsListSchema.safeParse(json.data ?? []);

  if (!parsed.success) {
    console.error(
      "[getProducts] ответ Strapi не прошёл валидацию:",
      parsed.error.issues,
    );
    return { items: [], page, hasNext: false };
  }

  const all = parsed.data.filter((item) => item.slug);

  return {
    items: all.slice(0, pageSize),
    page,
    hasNext: all.length > pageSize,
  };
};
