import { z } from "zod";

import type { MediaWithBreakpoints } from "@shared/types";

/**
 * Карточка товара в списке — минимальный набор для листинга.
 */
export const ProductCardSchema = z.object({
  documentId: z.string().catch(""),
  title: z.string().catch(""),
  slug: z.string().catch(""),
  price: z.coerce.number().catch(0),
  image: z
    .custom<MediaWithBreakpoints>()
    .nullish()
    .transform((v): MediaWithBreakpoints | null => v ?? null),
});

export type ProductCard = z.infer<typeof ProductCardSchema>;

export const ProductsListSchema = z.array(ProductCardSchema);

/**
 * Полная карточка товара для `/products/[slug]`.
 * `description` в Strapi — richtext (строка после сериализаторов); храним как nullable string.
 */
export const ProductSchema = ProductCardSchema.extend({
  description: z
    .string()
    .nullish()
    .transform((v): string | null => v ?? null),
});

export type Product = z.infer<typeof ProductSchema>;
