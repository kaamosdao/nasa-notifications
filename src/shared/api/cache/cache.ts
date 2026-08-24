import { LRUCache } from "lru-cache";

/**
 * Серверный кэш данных Strapi на базе lru-cache.
 *
 * Почему lru-cache, а не ручной `{ data, expiresAt }`:
 *  - `allowStale` — stale-while-revalidate: пользователь мгновенно получает прошлое значение,
 *    обновление идёт в фоне; никто не ждёт CMS на «холодной» записи.
 *  - `fetchMethod` + `.fetch()` — single-flight: параллельные запросы одного ключа разделяют
 *    ОДИН промис, поэтому всплеск трафика/холодный старт не бьёт по Strapi пачкой одинаковых запросов.
 *  - `noDeleteOnFetchRejection` — при падении CMS отдаём последнее известное значение, а не 500.
 *  - `max` — ограничение по числу ключей (LRU-вытеснение), защита от роста памяти.
 *  - `ttl` — срок жизни записи, настраивается пер-ключ.
 *
 * Ограничение: кэш живёт в памяти процесса. Для одного контейнера этого достаточно; при
 * нескольких репликах у каждой будет свой экземпляр, и инвалидация до соседей не дойдёт —
 * тогда понадобится общее хранилище (Redis), ради чего доступ и спрятан за `cached()`.
 */

/**
 * TTL по умолчанию.
 *
 * Свежесть обеспечивает вебхук `/api/revalidate` (сброс по тегам), а TTL — страховка на
 * случай, когда вебхук не дошёл: упала сеть, перезапустили контейнер, хук выключили в админке.
 * Минута выбрана как безопасный дефолт шаблона: если на проекте вебхук ещё не настроен,
 * контент протухает не дольше минуты. **Настроив вебхук, TTL стоит поднять** (на боевых
 * проектах он measured в часах/днях) — это снимет фоновый трафик к Strapi.
 */
const DEFAULT_TTL_MS = 60_000;

// lru-cache требует non-nullable значение, а запрос легально возвращает null
// (например, пустой single type) — поэтому храним в «боксе».
type Box<T> = { value: T };
type FetchContext = { loader: () => Promise<unknown> };

function createCache() {
  return new LRUCache<string, Box<unknown>, FetchContext>({
    max: 200,
    ttl: DEFAULT_TTL_MS,
    allowStale: true,
    noDeleteOnFetchRejection: true,
    fetchMethod: async (_key, _staleValue, { context }) => ({
      value: await context.loader(),
    }),
  });
}

/**
 * И кэш, и карта тегов держатся в `globalThis`.
 *
 * Не только из-за HMR: страницы и API-роуты Next компилирует в РАЗНЫЕ бандлы, поэтому
 * модульные переменные у них свои. Если карту тегов оставить обычной переменной модуля,
 * у эндпоинта сброса она окажется пустой — вебхук отработает с `removed: 0` и ничего не
 * сбросит, притом что кэш будет полон. Ошибка тихая: 200 OK и никакого эффекта.
 */
const globalRef = globalThis as typeof globalThis & {
  __strapiCache?: ReturnType<typeof createCache>;
  __strapiCacheTags?: Map<string, string[]>;
};

globalRef.__strapiCache ??= createCache();
const cache = globalRef.__strapiCache;

/** Теги записи — по ним вебхук находит, что сбросить. */
globalRef.__strapiCacheTags ??= new Map<string, string[]>();
const keyTags = globalRef.__strapiCacheTags;

/** Аварийный выключатель — экономит часы при отладке контента. */
const isDisabled = () => process.env.STRAPI_CACHE_DISABLED === "true";

export type CachedOptions = {
  ttlMs?: number;
  /** Теги для точечной инвалидации вебхуком (см. cache/tags.ts). */
  tags?: string[];
};

/**
 * Возвращает закэшированное значение по ключу; при промахе/устаревании грузит через `loader`.
 * Параллельные вызовы одного ключа делят один промис (single-flight).
 *
 * ⚠️ Кэшировать можно только ДЕТЕРМИНИРОВАННЫЕ запросы: если функция материализует случайное
 * значение (порядок выдачи, позицию блока) или читает текущую дату — оно заморозится на весь
 * срок жизни записи.
 *
 * ⚠️ Ключ обязан включать ВСЕ параметры запроса (slug, страницу, фильтры, status). Иначе разные
 * варианты начнут молча отдавать контент друг друга.
 */
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  options?: CachedOptions,
): Promise<T> {
  if (isDisabled()) return loader();

  if (options?.tags?.length) {
    keyTags.set(key, options.tags);
  }

  const box = await cache.fetch(key, {
    ttl: options?.ttlMs,
    context: { loader: loader as () => Promise<unknown> },
    allowStaleOnFetchRejection: true,
    allowStaleOnFetchAbort: true,
  });
  // box не может быть undefined при заданном fetchMethod, но подстрахуемся.
  return (box?.value ?? (await loader())) as T;
}

/** Точечная инвалидация ключа. */
export function invalidate(key: string): void {
  cache.delete(key);
  keyTags.delete(key);
}

/** Сбрасывает записи, помеченные любым из переданных тегов. Возвращает число удалённых. */
export function invalidateTags(tags: string[]): number {
  let removed = 0;

  for (const [key, entryTags] of keyTags) {
    if (!entryTags.some((tag) => tags.includes(tag))) continue;

    cache.delete(key);
    keyTags.delete(key);
    removed += 1;
  }

  return removed;
}

/** Полный сброс — для неизвестной модели и ручного вызова. */
export function invalidateAll(): number {
  const removed = cache.size;

  cache.clear();
  keyTags.clear();

  return removed;
}

type StatusOptions = { status?: "draft" | "published" };

/**
 * Оборачивает фетчер кэшем, СОХРАНЯЯ его сигнатуру.
 *
 * Подключение сводится к переименованию исходной функции (`getX` → `getXUncached`) — вызывающий
 * код не меняется. Статус входит в ключ, поэтому опубликованная и черновая версии не перетирают
 * друг друга. Превью кэш обходит целиком: редактор обязан видеть правку сразу.
 *
 * ⚠️ Оборачивать можно только фетчеры, результат которых определяется одним `status`. Если
 * функция принимает slug/страницу/фильтры — ключ окажется общим на разные данные, и страницы
 * начнут молча отдавать чужой контент. В таком случае собирай ключ вручную через `cached()`.
 *
 * @example
 * const getFiltersUncached = async (options?: { status?: "draft" | "published" }) => { ... };
 * export const getFilters = cachedFetcher("filters", getFiltersUncached, {
 *   tags: [CACHE_TAGS.pageContent],
 * });
 */
export function cachedFetcher<TResult>(
  key: string,
  fetcher: (options?: StatusOptions) => Promise<TResult>,
  options: { tags: string[]; ttlMs?: number },
) {
  return (callOptions?: StatusOptions): Promise<TResult> => {
    if (callOptions?.status === "draft") {
      return fetcher(callOptions);
    }

    return cached(`${key}:published`, () => fetcher(callOptions), {
      tags: options.tags,
      ttlMs: options.ttlMs,
    });
  };
}
