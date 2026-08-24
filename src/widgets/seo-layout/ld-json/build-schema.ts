import type { LinkSocial, Organization } from "@shared/types/seo";

/**
 * Автоматическая генерация schema.org из полей CMS.
 *
 * Главный принцип: **редактор не должен собирать техническую разметку руками**. Базовые сущности
 * (`WebSite`, `Organization`, `BreadcrumbList`) строятся из обычных полей глобальных настроек и
 * маршрута страницы, а ручной `structuredData` остаётся дополнением для редких случаев.
 *
 * Второй принцип: **не выводить того, чего нет**. Пустые поля выбрасываются (`compact`), потому что
 * пустые значения в разметке — это ошибка валидатора, а выдуманные (рейтинги, цены, наличие) —
 * прямое нарушение правил поисковиков.
 *
 * Узлы связываются через `@id`, чтобы поисковик понимал: `WebSite` издаёт та же организация,
 * что описана в `Organization` — а не две разные сущности.
 */

export type JsonLdNode = Record<string, unknown>;

/** Стабильные идентификаторы узлов графа: строятся от origin, поэтому уникальны для сайта. */
const websiteId = (origin: string) => `${origin}/#website`;
const organizationId = (origin: string) => `${origin}/#organization`;

const isEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;

  return false;
};

/**
 * Убирает пустые поля рекурсивно. Узел, у которого не осталось ничего, кроме служебных
 * `@type`/`@id`, считается пустым и не попадает в граф.
 */
const compact = (node: JsonLdNode): JsonLdNode | null => {
  const result: JsonLdNode = {};

  for (const [key, value] of Object.entries(node)) {
    if (isEmpty(value)) continue;

    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      value !== null &&
      !(value instanceof Date)
    ) {
      const nested = compact(value as JsonLdNode);
      if (nested) result[key] = nested;
      continue;
    }

    result[key] = value;
  }

  // Пустым считается узел, где не осталось ничего, кроме `@type`. `@id` из фильтра исключён
  // намеренно: `{ "@id": ... }` — это валидная ССЫЛКА на другой узел графа, ею и связываются
  // сущности (например `WebSite.publisher` → `Organization`).
  const meaningful = Object.keys(result).filter((key) => key !== "@type");

  return meaningful.length > 0 ? result : null;
};

/** Делает URL абсолютным — в разметке относительные пути невалидны. */
const absolute = (
  url: string | undefined,
  origin: string,
): string | undefined => {
  if (!url) return undefined;
  if (/^(https?:)?\/\//i.test(url)) return url;

  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
};

/** Сайт как сущность. Издатель ссылкой на `Organization`, а не копией данных. */
export const buildWebSite = ({
  origin,
  siteName,
  description,
  hasOrganization,
}: {
  origin: string;
  siteName?: string;
  description?: string;
  hasOrganization: boolean;
}): JsonLdNode | null => {
  // Сайт без названия не описывает ничего — такой узел только засоряет граф.
  if (!siteName?.trim()) return null;

  return compact({
    "@type": "WebSite",
    "@id": websiteId(origin),
    url: `${origin}/`,
    name: siteName,
    description,
    publisher: hasOrganization ? { "@id": organizationId(origin) } : undefined,
  });
};

/**
 * Организация из блока глобальных данных.
 *
 * `sameAs` собирается из соцсетей — это их прямое назначение в разметке.
 * Адрес и координаты выводятся только целиком осмысленными: пустой `PostalAddress`
 * или половина координат хуже, чем их отсутствие.
 */
export const buildOrganization = ({
  organization,
  socials,
  origin,
}: {
  organization: Organization | null;
  socials: LinkSocial[];
  origin: string;
}): JsonLdNode | null => {
  if (!organization) return null;

  const sameAs = socials
    .map((social) => social?.url)
    .filter((url): url is string => Boolean(url?.trim()));

  const hasCoordinates =
    typeof organization.latitude === "number" &&
    typeof organization.longitude === "number";

  const node = compact({
    "@type": organization.schemaType || "Organization",
    "@id": organizationId(origin),
    url: `${origin}/`,
    name: organization.name,
    legalName: organization.legalName,
    description: organization.description,
    logo: absolute(organization.logo?.url, origin),
    telephone: organization.phone,
    email: organization.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: organization.streetAddress,
      addressLocality: organization.addressLocality,
      addressRegion: organization.addressRegion,
      postalCode: organization.postalCode,
      addressCountry: organization.addressCountry,
    },
    geo: hasCoordinates
      ? {
          "@type": "GeoCoordinates",
          latitude: organization.latitude,
          longitude: organization.longitude,
        }
      : undefined,
    openingHours: organization.openingHours,
    sameAs,
  });

  // Блок организации может существовать пустым (редактор добавил и не заполнил). Узел из
  // одних служебных полей — не данные, поэтому в граф он не идёт.
  const facts = node
    ? Object.keys(node).filter(
        (key) => key !== "@type" && key !== "@id" && key !== "url",
      )
    : [];

  return facts.length > 0 ? node : null;
};

/**
 * Подписи статических сегментов пути для хлебных крошек.
 * Сегмент без подписи в крошки НЕ попадает — лучше короткая цепочка, чем «Products» → «kakoy-to-slug».
 */
export const BREADCRUMB_LABELS: Record<string, string> = {
  "/": "Главная",
  "/products": "Products",
  "/about": "About",
};

/**
 * Хлебные крошки из пути страницы.
 *
 * Последний сегмент подписывается заголовком самой страницы (он уже есть в SEO-цепочке), поэтому
 * карточка товара даёт «Главная → Products → Название товара», а не машинный slug.
 * Возвращает `null` для главной: цепочка из одного элемента бесполезна.
 */
export const buildBreadcrumbList = ({
  origin,
  path,
  pageTitle,
}: {
  origin: string;
  path: string;
  pageTitle?: string;
}): JsonLdNode | null => {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const items: JsonLdNode[] = [
    {
      "@type": "ListItem",
      position: 1,
      name: BREADCRUMB_LABELS["/"],
      item: `${origin}/`,
    },
  ];

  let current = "";

  segments.forEach((segment, index) => {
    current += `/${segment}`;

    const isLast = index === segments.length - 1;
    // Последний сегмент — сама страница: берём её заголовок. Промежуточные — только из карты
    // подписей, иначе в крошки уедет slug.
    const name = isLast
      ? pageTitle || BREADCRUMB_LABELS[current]
      : BREADCRUMB_LABELS[current];

    if (!name) return;

    items.push({
      "@type": "ListItem",
      position: items.length + 1,
      name,
      item: `${origin}${current}`,
    });
  });

  if (items.length < 2) return null;

  return {
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
};

/**
 * Собирает граф разметки страницы: автоузлы + ручной `structuredData` из CMS.
 *
 * Всё живёт в одном `@graph` — так узлы связаны между собой через `@id`, а на странице остаётся
 * один тег `application/ld+json` вместо нескольких несвязанных.
 */
export const buildSchemaGraph = ({
  origin,
  siteName,
  description,
  organization,
  socials,
  path,
  pageTitle,
  manual,
}: {
  origin: string;
  siteName?: string;
  description?: string;
  organization: Organization | null;
  socials: LinkSocial[];
  path: string;
  pageTitle?: string;
  manual?: unknown;
}): JsonLdNode | null => {
  // Без origin (не задан NEXT_PUBLIC_SITE_URL) идентификаторы и ссылки получатся битыми —
  // лучше не выводить разметку вовсе, чем выводить относительные `@id`.
  if (!origin) return null;

  const organizationNode = buildOrganization({ organization, socials, origin });

  const nodes = [
    buildWebSite({
      origin,
      siteName,
      description,
      hasOrganization: Boolean(organizationNode),
    }),
    organizationNode,
    buildBreadcrumbList({ origin, path, pageTitle }),
  ].filter((node): node is JsonLdNode => node !== null);

  // Ручная разметка добавляется как есть, но без собственного `@context`: контекст один на граф.
  if (manual) {
    const manualNodes = Array.isArray(manual) ? manual : [manual];

    for (const node of manualNodes) {
      if (!node || typeof node !== "object") continue;

      const { "@context": _context, ...rest } = node as JsonLdNode;
      if (Object.keys(rest).length > 0) nodes.push(rest);
    }
  }

  if (nodes.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
};
