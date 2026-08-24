import { strapiClient } from "@shared/api/strapi/strapi-client";

/**
 * Статические маршруты и single-type'ы, в которых лежит их SEO.
 *
 * Статические страницы приходят из файловой системы (`scan-pages`), поэтому флаг `seo.noindex`
 * у них взять неоткуда — связь «маршрут → single type» нужно объявить явно. Зарегистрированная
 * страница исключается из sitemap, если редактор поставил ей `noindex`.
 *
 * Роут без записи здесь просто всегда попадает в карту — это безопасный дефолт: лучше лишний
 * URL, чем потерянный. Добавляя страницу с SEO-компонентом, регистрируй её тут.
 */
export const STATIC_PAGE_SEO: Array<{ path: string; uid: string }> = [
  { path: "/", uid: "home-page" },
  // { path: "/about", uid: "about-page" },
];

/**
 * Возвращает пути статических страниц, закрытых от индексации в CMS.
 *
 * `allSettled` + «при ошибке не исключаем»: недоступность одного single type не должна
 * выкидывать страницу из карты — падаем в сторону включения (fail open).
 */
export async function fetchNoindexStaticPaths(): Promise<Set<string>> {
  const excluded = new Set<string>();

  const results = await Promise.allSettled(
    STATIC_PAGE_SEO.map(async ({ path, uid }) => {
      const json = await strapiClient.single(uid).find({
        // Только флаг — сам SEO-компонент здесь не нужен.
        populate: { seo: { fields: ["noindex"] } },
        status: "published",
      });

      const data = json.data as { seo?: { noindex?: boolean | null } | null };

      // Строгое сравнение: исключаем только явный true.
      return { path, noindex: data?.seo?.noindex === true };
    }),
  );

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      if (result.value.noindex) excluded.add(result.value.path);
      return;
    }

    console.error(
      `[sitemap] не удалось прочитать seo.noindex для "${STATIC_PAGE_SEO[index].uid}":`,
      result.reason,
    );
  });

  return excluded;
}
