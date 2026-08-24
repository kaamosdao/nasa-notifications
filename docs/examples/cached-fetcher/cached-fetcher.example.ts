// Эталон КЕША С ТЕГАМИ + обёртки cachedFetcher (для AI-контекста). Вынесено из боевого
// проекта sozdateli — это расширение того, что уже есть в сборке (src/shared/api/cache.ts:
// cached/invalidate/invalidateAll). Отличия от текущего cache.ts перечислены в docs.md.
//
// Что добавляет поверх сборки:
//  1) теги записей + invalidateTags() — точечный сброс по вебхуку (cache-tags.example.ts);
//  2) cachedFetcher() — обёртка, подключающая кеш переименованием функции, без правки вызовов;
//  3) аварийный выключатель STRAPI_CACHE_DISABLED;
//  4) карта тегов в globalThis — иначе у API-роута она пустая (см. комментарий ниже).
//
// Скилл: caching-and-isr. Механика lru-cache: docs/11-server-cache.md.

import { LRUCache } from "lru-cache";

import { CACHE_TAGS, type CacheTag } from "./cache-tags.example";

/** Неделя — общие данные меняются редко, свежесть обеспечивает вебхук, а не TTL. */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** lru-cache не хранит undefined, а запрос легально возвращает null (пустой single type). */
type Box = { value: unknown };
type FetchContext = { loader: () => Promise<unknown> };

const createCache = () =>
  new LRUCache<string, Box, FetchContext>({
    // Ключей много: помимо общих данных кешируется контент страниц и справочники,
    // каждый со своим статусом.
    max: 500,
    ttl: DEFAULT_TTL_MS,
    allowStale: true, // stale-while-revalidate: посетитель не ждёт CMS
    noDeleteOnFetchRejection: true, // Strapi упал — отдаём последнее известное значение
    fetchMethod: async (_key, _staleValue, { context }) => ({
      value: await context.loader(),
    }),
  });

/**
 * И кеш, и карта тегов держатся в `globalThis`.
 *
 * Не только из-за HMR: страницы и API-роуты Next компилирует в **разные бандлы**, поэтому
 * модульные переменные у них свои. Если карту тегов оставить обычной переменной модуля,
 * у эндпоинта сброса она окажется пустой — вебхук отработает с `removed: 0` и ничего не
 * сбросит, притом что кеш будет полон. Ошибка тихая: 200 OK и никакого эффекта.
 */
const globalRef = globalThis as typeof globalThis & {
  __strapiCache?: ReturnType<typeof createCache>;
  __strapiCacheTags?: Map<string, string[]>;
};

// Присваивание отдельным стейтментом, а не внутри выражения (правило biome
// lint/suspicious/noAssignInExpressions) — так же оформлено в src/shared/api/cache.ts.
globalRef.__strapiCache ??= createCache();
const cache = globalRef.__strapiCache;

/** Теги записи — по ним вебхук находит, что сбросить. */
globalRef.__strapiCacheTags ??= new Map<string, string[]>();
const keyTags = globalRef.__strapiCacheTags;

/** Аварийный выключатель — экономит часы при отладке контента. */
const isDisabled = () => process.env.STRAPI_CACHE_DISABLED === "true";

export type CachedOptions = {
  ttlMs?: number;
  tags?: string[];
};

/**
 * Выполняет `loader` через кеш.
 *
 * ⚠️ Кешировать можно только **детерминированные** запросы: если функция материализует
 * случайное значение (позицию рекламного блока, порядок выдачи) или читает текущую дату —
 * оно заморозится на весь срок жизни записи.
 *
 * ⚠️ Ключ обязан включать **все** параметры запроса. Фетчер, который выглядит как «принимает
 * только status», может иметь второй аргумент — вариант страницы или slug. Если он не попал
 * в ключ, разные варианты начнут молча отдавать контент друг друга.
 */
export const cached = async <T>(
  key: string,
  loader: () => Promise<T>,
  options?: CachedOptions,
): Promise<T> => {
  if (isDisabled()) return loader();

  if (options?.tags?.length) {
    keyTags.set(key, options.tags);
  }

  const box = await cache.fetch(key, {
    ttl: options?.ttlMs,
    context: { loader },
    allowStaleOnFetchRejection: true,
    allowStaleOnFetchAbort: true,
  });

  // Промах возможен, если запись выбросили между fetch и чтением.
  return (box?.value ?? (await loader())) as T;
};

/** Сбрасывает записи, помеченные любым из переданных тегов. Возвращает число удалённых. */
export const invalidateTags = (tags: string[]): number => {
  let removed = 0;

  for (const [key, entryTags] of keyTags) {
    if (!entryTags.some((tag) => tags.includes(tag))) continue;

    cache.delete(key);
    keyTags.delete(key);
    removed += 1;
  }

  return removed;
};

/** Полный сброс — для неизвестной модели и ручного вызова. */
export const invalidateAll = (): number => {
  const removed = cache.size;

  cache.clear();
  keyTags.clear();

  return removed;
};

type StatusOptions = { status?: "draft" | "published" };

/**
 * Оборачивает фетчер кешем, **сохраняя его сигнатуру**.
 *
 * Подключение сводится к переименованию исходной функции (`getX` → `getXUncached`) —
 * вызывающий код не меняется. Статус входит в ключ, поэтому опубликованная и черновая
 * версии не перетирают друг друга. Превью кеш обходит целиком: редактор обязан видеть
 * правку сразу, а не через неделю.
 *
 * ⚠️ Оборачивать можно только фетчеры, результат которых определяется одним `status`.
 * Если функция принимает slug/вариант/query — ключ окажется общим на разные данные,
 * и страницы начнут молча отдавать чужой контент (тогда собирай ключ вручную через `cached`).
 */
export const cachedFetcher = <TResult>(
  key: string,
  fetcher: (options?: StatusOptions) => Promise<TResult>,
  options: { tags: string[]; ttlMs?: number },
) => {
  return (callOptions?: StatusOptions): Promise<TResult> => {
    if (callOptions?.status === "draft") {
      return fetcher(callOptions);
    }

    return cached(`${key}:published`, () => fetcher(callOptions), {
      tags: options.tags,
      ttlMs: options.ttlMs,
    });
  };
};

// ── Применение ───────────────────────────────────────────────────────────────
// Было:  export const getHomeFilters = async (options?) => { ...запрос... }
// Стало: переименовать в getHomeFiltersUncached и обернуть — вызовы не трогаем.

type HomeFiltersData = { filters: unknown; roomAmounts: unknown[] };

const getHomeFiltersUncached = async (
  _options?: StatusOptions,
): Promise<HomeFiltersData> => {
  // ...запрос к Strapi (fields/populate — см. optimized-fetcher.example.ts)
  return { filters: null, roomAmounts: [] };
};

/**
 * Кешируется: результат зависит только от `status`, значит одинаков для всех посетителей.
 * Сброс — вебхуком из Strapi (`/api/revalidate`) по тегу `page-content`.
 */
export const getHomeFilters = cachedFetcher(
  "home-filters",
  getHomeFiltersUncached,
  { tags: [CACHE_TAGS.pageContent] },
);

// Пример ручного ключа, когда параметров больше одного: всё, что влияет на результат,
// обязано попасть в ключ (иначе разные фильтры отдадут контент друг друга).
export const getFilteredListing = (params: {
  status?: "draft" | "published";
  sortedFilters: string;
  page: number;
}) => {
  const tags: CacheTag[] = [CACHE_TAGS.dictionaries];

  return cached(
    `listing:${params.sortedFilters}:${params.page}:${params.status ?? "published"}`,
    async () => ({ items: [] as unknown[] }),
    { tags, ttlMs: 15_000 }, // короткий TTL: пользовательские фильтры — безграничное множество ключей
  );
};
