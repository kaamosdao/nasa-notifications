import { strapiClient } from "@shared/api/strapi";
import { mediaBreakpointsPopulate } from "@shared/api/strapi/populate";

import { type HomePageProps, HomePageSchema } from "../model/schemas";

/**
 * Получает данные главной страницы из Strapi и приводит их к доменной модели.
 * @param options - Опции для запроса, включая status для draft mode
 * @returns Доменная модель страницы либо `null`, если ответ пустой/не прошёл валидацию.
 */
export const getHomePage = async (options?: {
  status?: "draft" | "published";
}): Promise<HomePageProps | null> => {
  const homepage = strapiClient.single("home-page");

  const findOptions: Parameters<typeof homepage.find>[0] = {
    // Только нужные поля медиа вместо populate: "*" (см. src/shared/api/strapi/populate.ts).
    populate: {
      media: { populate: mediaBreakpointsPopulate },
      // SEO-компонент страницы: populate "*" внутри seo подтягивает ogImage (media).
      seo: { populate: "*" },
    },
  };

  // Добавляем status, если указан (для draft mode)
  if (options?.status) {
    findOptions.status = options.status;
  }

  const json = await homepage.find(findOptions);

  // Граница «внешние данные → домен»: валидируем и приводим к HomePageProps.
  // safeParse (а не parse) — чтобы кривой ответ дал null, а не исключение в getServerSideProps.
  const parsed = HomePageSchema.safeParse(json.data);

  if (!parsed.success) {
    console.error(
      "[getHomePage] ответ Strapi не прошёл валидацию:",
      parsed.error.issues,
    );
    return null;
  }

  return parsed.data;
};
