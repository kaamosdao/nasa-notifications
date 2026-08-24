import type { BlocksContent } from "@strapi/blocks-react-renderer";
import { z } from "zod";

import type { MediaWithBreakpoints } from "@shared/types";
import type { Seo } from "@shared/types/strapi-components";

const SectionSchema = z.object({
  id: z.string(),
});

export type SectionData = z.infer<typeof SectionSchema>;

/**
 * Доменная схема главной страницы — граница «сырой ответ Strapi → доменная модель».
 *
 * Схема НЕ описывает весь ответ CMS, а фиксирует ровно те поля, что нужны UI, и гарантирует
 * их форму в рантайме. Валидация мягкая: отсутствующие/битые поля не роняют парсинг, а дают
 * безопасный дефолт (`null`/`""`/`[]`), поэтому одна кривая запись в CMS не ломает страницу.
 *
 * `media`/`content` приходят от бэкенда уже в нужной форме (media-serializer + blocks), их
 * внутренности сложные и внешние по типам — валидируем нестрого через z.custom, но гарантируем
 * наличие/отсутствие (nullable). Тип `HomePageProps` выводится из схемы (единый источник правды).
 */
export const HomePageSchema = z.object({
  title: z.string().catch(""),
  media: z
    .custom<MediaWithBreakpoints>()
    .nullish()
    .transform((v): MediaWithBreakpoints | null => v ?? null),
  content: z
    .custom<BlocksContent>()
    .nullish()
    .transform((v): BlocksContent | null => v ?? null),
  blocks: z.array(SectionSchema).catch([]),
  // SEO-компонент страницы (widgets.seo). Внешняя по типам форма — валидируем нестрого,
  // но гарантируем null при отсутствии. Дальше уходит в cms.pageSeoData → SeoLayout как
  // верхнее звено fallback-цепочки (страница → commonData.seo → APP_INFO).
  seo: z
    .custom<Seo>()
    .nullish()
    .transform((v): Seo | null => v ?? null),
});

export type HomePageProps = z.infer<typeof HomePageSchema>;
