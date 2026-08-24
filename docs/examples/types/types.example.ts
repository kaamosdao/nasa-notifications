// Эталон типизации проекта (для AI-контекста): три уровня типов + утилиты + Zod-схема.
// Живой аналог: src/shared/types/index.ts (утилиты), src/shared/types/seo.ts (доменные типы).
//
// Разделение типов по назначению (по FSD прослеживается, границы держим руками):
//  • API-типы    — форма сырого ответа/параметров транспорта (строка БД, HTTP-ответ).
//  • DOMAIN-типы  — доменные модели после адаптации сырого CMS-ответа (часто через Zod).
//  • UI-типы      — пропсы компонентов (<Component>Props), то, чем оперирует представление.
//
// Именование файлов: общий barrel утилит — src/shared/types/index.ts; типы слайса —
// в model/ либо рядом. В репо встречаются и types.ts (преобладает), и type.ts — при
// создании нового файла предпочитай types.ts для единообразия.

import { z } from "zod";

/* ─────────────────────────── УТИЛИТАРНЫЕ ТИПЫ ───────────────────────────
 * Каноничный набор из src/shared/types/index.ts. Не плоди дубли — импортируй отсюда. */

export type Nullable<T> = T | null;

/** Branded type для типобезопасных идентификаторов. */
export type Brand<K, T> = K & { __brand: T };
export type EntityId = Brand<string, "EntityId">;

/** Обёртка списка в доменном виде (после адаптации ответа). */
export type ApiList<T> = {
  items: T[];
  total: number;
};

/* ───────────────────────────── API-ТИПЫ ─────────────────────────────
 * Форма сырого ответа списочного API: data[] + meta.pagination. */

export type ApiPagination = {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
};

export type ApiCollectionResponse<T> = {
  data: T[];
  meta: { pagination: ApiPagination };
};

/* ──────────────────────────── DOMAIN-ТИПЫ ────────────────────────────
 * Доменную модель описываем Zod-схемой и выводим тип через z.infer —
 * так получаем и рантайм-валидацию, и статический тип из одного источника. */

export const ProductSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  description: z.string().nullable(),
});

export type Product = z.infer<typeof ProductSchema>;

/* Адаптер: сырой CMS-ответ → доменная модель. Живёт в content-types/adapters или api/. */
export const toProduct = (raw: unknown): Product => ProductSchema.parse(raw);

/* ────────────────────────────── UI-ТИПЫ ──────────────────────────────
 * Пропсы компонента. Опираются на доменные типы, а не на сырой ответ. */

export type ProductCardProps = {
  product: Product;
  className?: string;
  onSelect?: (id: EntityId) => void;
};
