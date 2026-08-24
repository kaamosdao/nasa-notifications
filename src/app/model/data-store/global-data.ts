import { createDataStore } from "./create-data-store";

/**
 * Глобальные данные приложения — стабильны между переходами страниц.
 * Провайдер размещается ВНЕ TransitionLayout, поэтому не пересоздаётся при навигации.
 *
 * Сейчас пусто: контента как такового в проекте нет, данные приходят потоком из GCN.
 * Появится глобальное состояние (статус ingestor, фильтры по типам событий) — оно ляжет сюда.
 */
export type GlobalData = Record<string, never>;

export const [GlobalDataProvider, useGlobalData] =
  createDataStore<GlobalData>("GlobalData");
