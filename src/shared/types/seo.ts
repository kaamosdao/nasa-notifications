/**
 * Типы SEO-слоя (`src/widgets/seo-layout`).
 *
 * Раньше жили в `shared/types/strapi-components` и описывали компоненты CMS. Рантайм-зависимости
 * от CMS у SEO-виджета нет — он читает только форму данных, поэтому типы переехали сюда как есть.
 * Источник значений теперь — `APP_INFO` и данные страницы, а не Strapi.
 */

export type SeoImage = {
  url: string;
  alternativeText?: string | null;
  width?: number;
  height?: number;
  mime?: string;
};

export type Seo = {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: SeoImage;
  theme?: string;
  /** JSON-LD: допускаем и строку, и готовый объект — `LdJson` обрабатывает оба варианта. */
  structuredData?: string | Record<string, unknown> | unknown[];
  /** Закрыть страницу от индексации (→ meta robots noindex,nofollow, исключение из sitemap). */
  noindex?: boolean;
};

/**
 * Данные организации — единый источник правды для футера и schema.org Organization.
 */
export type Organization = {
  /** Тип schema.org: обычная компания, локальный бизнес, магазин, услуги. */
  schemaType?:
    | "Organization"
    | "LocalBusiness"
    | "Store"
    | "ProfessionalService";
  name?: string;
  legalName?: string;
  description?: string;
  logo?: SeoImage;
  phone?: string;
  email?: string;
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
  latitude?: number;
  longitude?: number;
  /** Часы работы в формате schema.org, например `Mo-Fr 09:00-18:00`. */
  openingHours?: string;
};

/** Соцсеть — источник `sameAs` для schema.org. */
export type LinkSocial = {
  url?: string;
  text?: string;
  target_blank?: boolean;
};
