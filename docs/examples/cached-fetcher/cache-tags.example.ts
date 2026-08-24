// Эталон СИСТЕМЫ ТЕГОВ кеша (для AI-контекста). Вынесено из боевого проекта sozdateli.
// Решает задачу: вебхук из Strapi должен сбрасывать ровно те записи кеша, которых коснулась
// правка, а не весь кеш и не «ничего, потому что модель неизвестна».
//
// Почему теги, а не «модель → один ключ»: один справочник (иконки, контакты) раскрывается
// сразу в нескольких источниках (шапка И подвал), а одна коллекция влияет на несколько
// подсистем (проекты = меню + sitemap + контент страниц). Ключей на это не хватает —
// нужна связь many-to-many, её и дают теги.
//
// Связанное: cached-fetcher.example.ts (сами теги проставляются там), isr-revalidate.example.ts.
// Скилл: caching-and-isr.

export const CACHE_TAGS = {
  common: "common",
  header: "header",
  footer: "footer",
  menuProjects: "menu-projects",
  sitemap: "sitemap",
  /** Контент страниц: single types и общие секции конструктора. */
  pageContent: "page-content",
  /** Справочники: комнатность, типы точек, счётчики, лейблы. */
  dictionaries: "dictionaries",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

export const ALL_TAGS: CacheTag[] = Object.values(CACHE_TAGS);

/**
 * Какие теги протухают при изменении модели.
 *
 * Сопоставление живёт на фронте, а не в Strapi, сознательно: это одна точка правды,
 * и вебхук настраивается мышкой в админке без деплоя бэкенда.
 *
 * Логика выбора по умолчанию: **лишний сброс дёшев** — данные перезапросятся один раз и снова
 * живут неделю; **пропущенный дорог** — устаревший контент провисит весь срок жизни записи.
 * Поэтому справочники, попадающие сразу в несколько блоков, сбрасывают их все, а неизвестная
 * модель сбрасывает всё (см. `tagsForModel`).
 */
const MODEL_TAGS: Record<string, CacheTag[]> = {
  "api::common.common": [CACHE_TAGS.common],
  "api::header.header": [CACHE_TAGS.header],
  "api::footer.footer": [CACHE_TAGS.footer],

  // Справочники раскрываются и в шапке, и в подвале — сбрасываем оба.
  "api::contact.contact": [CACHE_TAGS.header, CACHE_TAGS.footer],
  "api::icon.icon": [CACHE_TAGS.header, CACHE_TAGS.footer],

  // Коллекция влияет сразу на меню, карту сайта и контент страниц.
  "api::project.project": [
    CACHE_TAGS.menuProjects,
    CACHE_TAGS.sitemap,
    CACHE_TAGS.pageContent,
  ],
  "api::common-section.common-section": [CACHE_TAGS.pageContent],
  "api::room-amount.room-amount": [CACHE_TAGS.dictionaries],

  // Коллекции с детальными страницами меняют карту сайта — и справочники: границы
  // min/max для ползунков фильтров считаются по этим же коллекциям, и без сброса
  // dictionaries ночной импорт менял бы цены, а фильтры жили бы со старыми границами.
  "api::apartment.apartment": [CACHE_TAGS.sitemap, CACHE_TAGS.dictionaries],
  "api::promotion-card.promotion-card": [CACHE_TAGS.sitemap],
};

/** Неизвестная модель → сбрасываем всё: пропустить инвалидацию дороже, чем перезапросить. */
export const tagsForModel = (uid?: string | null): CacheTag[] => {
  if (!uid) return ALL_TAGS;

  return MODEL_TAGS[uid] ?? ALL_TAGS;
};
