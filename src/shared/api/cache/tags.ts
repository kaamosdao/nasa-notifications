/**
 * Теги кэша и их связь с моделями Strapi.
 *
 * Зачем теги, а не «модель → один ключ»: связь между моделями и кэшем — many-to-many.
 * Один справочник (контакты, категории) раскрывается сразу в нескольких источниках, а одна
 * коллекция влияет на несколько подсистем (товары = карточки + sitemap). Ключами это не
 * выражается — записи помечаются тегами, вебхук сбрасывает по тегу.
 *
 * Сопоставление живёт на фронте, а не в Strapi, сознательно: это одна точка правды,
 * и вебхук настраивается мышкой в админке без деплоя бэкенда.
 */

export const CACHE_TAGS = {
  /** Глобальные данные сайта: single-type `common` (SEO по умолчанию, соцсети, контакты). */
  common: "common",
  /** Набор публичных URL карты сайта. */
  sitemap: "sitemap",
  /** Контент страниц: single types и секции конструктора. */
  pageContent: "page-content",
  /** Справочники: категории, счётчики, лейблы. */
  dictionaries: "dictionaries",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

export const ALL_TAGS: CacheTag[] = Object.values(CACHE_TAGS);

/**
 * Какие теги протухают при изменении модели.
 *
 * Логика выбора по умолчанию: **лишний сброс дёшев** — данные перезапросятся один раз;
 * **пропущенный дорог** — устаревший контент провисит весь срок жизни записи. Поэтому
 * модель, попадающая сразу в несколько мест, сбрасывает их все, а неизвестная модель
 * сбрасывает всё (см. `tagsForModel`).
 *
 * Ключом служит uid (`api::<singular>.<singular>`). Добавляя кэшируемый источник,
 * зарегистрируй его модель здесь, иначе правка в CMS будет догоняться только по TTL.
 */
const MODEL_TAGS: Record<string, CacheTag[]> = {
  // Глобальные данные — шапка/подвал/соцсети/контакты/глобальный SEO.
  "api::common.common": [CACHE_TAGS.common],

  // Контакты раскрываются внутри common (подвал/страница контактов).
  "api::contact.contact": [CACHE_TAGS.common],

  // Контент страниц.
  "api::home-page.home-page": [CACHE_TAGS.pageContent],

  // Коллекции с публичными детальными страницами меняют и карту сайта.
  "api::product.product": [CACHE_TAGS.sitemap, CACHE_TAGS.pageContent],
  "api::category.category": [CACHE_TAGS.sitemap, CACHE_TAGS.dictionaries],
};

/** Неизвестная модель → сбрасываем всё: пропустить инвалидацию дороже, чем перезапросить. */
export const tagsForModel = (uid?: string | null): CacheTag[] => {
  if (!uid) return ALL_TAGS;

  return MODEL_TAGS[uid] ?? ALL_TAGS;
};

/**
 * Нормализует то, что присылает вебхук Strapi, к uid.
 * В payload приходит либо `uid` (`api::product.product`), либо `model` (`product`).
 */
export const toModelUid = (
  uid?: string | null,
  model?: string | null,
): string | undefined => {
  if (uid) return uid;
  if (model) return `api::${model}.${model}`;

  return undefined;
};
