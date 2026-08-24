import type { Image } from "./shared";

export type Seo = {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: Image;
  theme?: string;
  /**
   * JSON-LD из CMS. В Strapi это поле типа `json`, но приходит СТРОКОЙ, которую редактор
   * пишет руками. Объект допускаем на случай, если разметку соберут в коде или поле начнёт
   * приходить распарсенным — `LdJson` обрабатывает оба варианта.
   */
  structuredData?: string | Record<string, unknown> | unknown[];
  /** Закрыть страницу от индексации (→ meta robots noindex,nofollow, исключение из sitemap). */
  noindex?: boolean;
};

/**
 * Данные организации из глобальных настроек (компонент `widgets.organization`).
 *
 * Единый источник правды для футера, страницы контактов и schema.org — иначе карточка
 * организации в разметке расходится с тем, что видит пользователь на сайте.
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
  logo?: Image;
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

/** Соцсеть из глобальных данных — источник `sameAs` для schema.org. */
export type LinkSocial = {
  url?: string;
  text?: string;
  target_blank?: boolean;
};
