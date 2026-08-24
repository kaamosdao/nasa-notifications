/**
 * Построение canonical и разбор пагинации.
 *
 * Правило: из query в canonical попадают ТОЛЬКО явно разрешённые для этого маршрута параметры.
 * Аллоу-лист, а не блок-лист трекеров: список рекламных меток (`utm_*`, `fbclid`, `gclid`,
 * `yclid`, …) бесконечен и постоянно пополняется, а список значимых параметров короткий и
 * известен заранее. Всё неразрешённое отбрасывается автоматически.
 *
 * Зачем вообще пускать что-то из query: страница пагинации — самостоятельная страница с другим
 * содержимым. Если увести её canonical на базовый листинг, поисковик считает её дублем первой
 * страницы, и товары со второй и дальше могут не попасть в индекс вовсе.
 */

export const PAGE_PARAM = "page";

/**
 * Значимые для canonical query-параметры по маршрутам.
 *
 * Ключ — `router.pathname` (ШАБЛОН роута, например `/products`), а не `asPath`. Иначе правило
 * листинга случайно применилось бы к `/products/kakoy-to-slug`.
 *
 * ⚠️ Добавляя сюда параметр, убедись, что страница действительно отдаёт по нему ДРУГОЙ контент.
 * Разрешить параметр, который сервер игнорирует, — значит создать дубль: два индексируемых URL
 * с одинаковым содержимым.
 */
export const CANONICAL_PARAMS: Record<string, string[]> = {
  "/products": [PAGE_PARAM],
};

/**
 * Нормализаторы значений: приводят параметр к каноничному виду или отбрасывают его (`null`).
 *
 * Отбрасывать невалидное обязательно. Роут схлопывает `?page=abc` и `?page=1` в первую
 * страницу, поэтому такой URL отдаёт контент базового листинга — оставить его в canonical
 * значило бы завести дубль: два индексируемых адреса с одинаковым содержимым.
 * Нормализация заодно схлопывает `?page=02` и `?page=2` в один canonical.
 *
 * Параметр без нормализатора попадает в canonical как есть.
 */
const PARAM_NORMALIZERS: Record<string, (value: string) => string | null> = {
  [PAGE_PARAM]: (value) => {
    const page = Number.parseInt(value, 10);

    // Первая страница эквивалентна базовому URL, поэтому тоже отбрасывается.
    return Number.isFinite(page) && page > 1 ? String(page) : null;
  },
};

/**
 * Закрывать ли страницы пагинации (2+) от индексации.
 *
 * `false` — стратегия по умолчанию: страницы пагинации индексируются и канонизируются сами на
 * себя. Так глубокие карточки гарантированно обходятся ботом.
 * `true` — если SEO-специалист проекта не хочет видеть листинги в индексе (`noindex,follow`).
 * В этом случае карточки обязаны надёжно покрываться sitemap: Google со временем начинает
 * трактовать долгий `noindex` как `nofollow`, и обход по ссылкам листинга перестаёт работать.
 */
export const PAGINATION_NOINDEX = false;

/** Разбирает `asPath` на путь и query-строку. */
const splitPath = (asPath: string): [string, string] => {
  const [path, query = ""] = asPath.split("?");
  return [path, query];
};

/**
 * Путь для canonical: базовый путь + только разрешённые параметры в стабильном порядке.
 *
 * Порядок параметров задаётся аллоу-листом, а не порядком в URL: иначе `?page=2&sort=x` и
 * `?sort=x&page=2` дали бы два разных canonical на одну и ту же страницу.
 */
export const buildCanonicalPath = (
  asPath: string,
  pathname: string,
): string => {
  const [path, queryString] = splitPath(asPath);
  const allowed = CANONICAL_PARAMS[pathname];

  if (!allowed?.length || !queryString) return path;

  const incoming = new URLSearchParams(queryString);
  const kept = new URLSearchParams();

  for (const key of [...allowed].sort()) {
    const value = incoming.get(key);
    if (!value) continue;

    const normalize = PARAM_NORMALIZERS[key];
    const normalized = normalize ? normalize(value) : value;
    if (normalized === null) continue;

    kept.set(key, normalized);
  }

  const query = kept.toString();

  return query ? `${path}?${query}` : path;
};

/**
 * Номер страницы пагинации, если он значим для этого маршрута и больше первой страницы.
 * Возвращает `null` для первой страницы, невалидных значений и маршрутов без пагинации —
 * то есть «эта страница ничем не отличается от базовой».
 */
export const getPaginationPage = (
  asPath: string,
  pathname: string,
): number | null => {
  if (!CANONICAL_PARAMS[pathname]?.includes(PAGE_PARAM)) return null;

  const [, queryString] = splitPath(asPath);
  if (!queryString) return null;

  const raw = new URLSearchParams(queryString).get(PAGE_PARAM);
  if (!raw) return null;

  const page = Number.parseInt(raw, 10);

  return Number.isFinite(page) && page > 1 ? page : null;
};
