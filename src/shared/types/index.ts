import type { ComponentProps, ComponentType, JSX } from "react";

import type { BREAKPOINTS } from "@shared/config";

/**
 * Утилитарный тип для компонента или HTML тега
 */
export type ComponentOrTag<Props = any> =
  | keyof JSX.IntrinsicElements
  | ComponentType<Props>;

/**
 * Динамические пропсы для компонента с возможностью указать тег
 */
export type DynamicProps<Element extends ComponentOrTag> = {
  tag?: Element;
} & (Element extends ComponentType<infer Props>
  ? Props
  : Element extends keyof JSX.IntrinsicElements
    ? ComponentProps<Element>
    : never);

/**
 * Branded type утилита для создания типов с меткой
 * Используется для создания типов с дополнительной типобезопасностью
 */
export type Brand<K, T> = K & { __brand: T };

/**
 * Тип для идентификатора сущности (branded string)
 */
export type EntityId = Brand<string, "EntityId">;

/**
 * Обертка для списка элементов в API ответе
 */
export type ApiList<T> = {
  items: T[];
  total: number;
};

/**
 * Утилитарный тип для nullable значений
 */
export type Nullable<T> = T | null;

/**
 * Ключи breakpoints для viewport (медиа-запросы)
 * Используется для адаптивного дизайна на основе ширины экрана
 * @see src/shared/config/breakpoints.ts
 */
export type BreakpointKeys = keyof typeof BREAKPOINTS;

/**
 * Размеры для UI элементов (иконки, кнопки, инпуты, ссылки)
 * Использует короткие названия для удобства использования в компонентах
 */
export type ElementSize = "xs" | "s" | "m" | "l" | "xl";

export type { LinkSocial, Organization, Seo, SeoImage } from "./seo";
