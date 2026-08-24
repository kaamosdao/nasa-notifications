import { createDataStore } from "./create-data-store";

/**
 * Данные конкретной страницы — меняются при каждом переходе.
 * Провайдер размещается ВНУТРИ TransitionLayout, чтобы при анимации перехода старая и новая
 * страницы видели свои данные. Форму данных задаёт потребитель через дженерик:
 *   const { homePage } = usePageData<{ homePage: HomePageProps }>();
 */
export const [PageDataProvider, usePageData] =
  createDataStore<Record<string, unknown>>("PageData");
