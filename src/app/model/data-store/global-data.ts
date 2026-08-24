import type { CommonData } from "@shared/api/strapi";

import { createDataStore } from "./create-data-store";

/**
 * Глобальные данные сайта — стабильны между переходами страниц (меню, футер, соцсети, SEO).
 * Провайдер размещается ВНЕ TransitionLayout, поэтому не пересоздаётся при навигации.
 */
export type GlobalData = {
  commonData: CommonData | null;
};

export const [GlobalDataProvider, useGlobalData] =
  createDataStore<GlobalData>("GlobalData");
