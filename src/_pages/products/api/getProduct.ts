import { strapiClient } from "@shared/api/strapi";
import { mediaBreakpointsPopulate } from "@shared/api/strapi/populate";

import { type Product, ProductSchema } from "../model/schemas";

type GetProductOptions = {
  slug: string;
  status?: "draft" | "published";
};

/**
 * Один товар по slug. Возвращает null, если не найден / не прошёл Zod.
 */
export const getProduct = async (
  options: GetProductOptions,
): Promise<Product | null> => {
  const { slug, status } = options;
  if (!slug) return null;

  const products = strapiClient.collection("products");

  const findOptions: Parameters<typeof products.find>[0] = {
    fields: ["title", "slug", "price", "description"],
    filters: { slug: { $eq: slug } },
    populate: {
      image: { populate: mediaBreakpointsPopulate },
    },
    pagination: { page: 1, pageSize: 1, withCount: false },
  };

  if (status) {
    findOptions.status = status;
  }

  const json = await products.find(findOptions);
  const raw = json.data?.[0];
  if (!raw) return null;

  const parsed = ProductSchema.safeParse(raw);

  if (!parsed.success) {
    console.error(
      "[getProduct] ответ Strapi не прошёл валидацию:",
      parsed.error.issues,
    );
    return null;
  }

  return parsed.data;
};
