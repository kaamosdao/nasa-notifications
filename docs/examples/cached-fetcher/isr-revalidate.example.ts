// Эталон ISR-ИНВАЛИДАЦИИ: карта путей + вебхук, сбрасывающий ДВА слоя (для AI-контекста).
// Вынесено из боевого проекта sozdateli.
//
// ГЛАВНОЕ ПРАВИЛО, ради которого файл существует:
//   теги сбрасывают кеш ДАННЫХ (LRU), пути — готовый HTML в кеше ISR.
//   Одно без другого не работает, и порядок обязателен: СНАЧАЛА теги, ПОТОМ res.revalidate().
//   Иначе регенерация прочитает старые данные из LRU и запишет их в статику на весь срок
//   ревалидации — «сброс» закрепит ровно то, что мы пытались обновить.
//
// Связанное: cache-tags.example.ts, cached-fetcher.example.ts. Скилл: caching-and-isr.

import type { NextApiRequest, NextApiResponse } from "next";

import { ALL_TAGS, type CacheTag, tagsForModel } from "./cache-tags.example";
import { invalidateAll, invalidateTags } from "./cached-fetcher.example";

import { timingSafeEqual } from "node:crypto";

// ── 1. Карта путей ───────────────────────────────────────────────────────────

type EntryLike = {
  slug?: unknown;
  /** Прошлый slug приходит не от всех версий Strapi, поэтому необязателен. */
  previousSlug?: unknown;
};

const asSlug = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/**
 * Одиночные типы и их ISR-страницы.
 *
 * ⚠️ Здесь перечисляются ТОЛЬКО роуты, реально переведённые на `getStaticProps`.
 * Записать страницу заранее нельзя: `res.revalidate()` по адресу, который рендерится на
 * каждый запрос (SSR), вернёт ошибку и зашумит лог.
 *
 * ⚠️ Не путать `api::contact.contact` (справочник контактов для шапки/подвала) с
 * `api::contact-page.contact-page` (сама страница). Перепутать легко, последствие тихое:
 * правка не доедет до статики.
 */
const SINGLE_TYPE_ROUTES: Record<string, string> = {
  "api::home-page.home-page": "/",
  "api::about-page.about-page": "/about",
  "api::contact-page.contact-page": "/contact",
  "api::promotions-page.promotions-page": "/promotions",
};

/** Базовые маршруты детальных ISR-страниц (`/promotions/[slug]`). */
const DETAIL_ROUTES: Record<string, string> = {
  "api::promotion-card.promotion-card": "/promotions",
};

/**
 * Списочные страницы, зависящие от коллекции целиком: изменение одной карточки меняет
 * и список, поэтому к пути детальной добавляется путь списка.
 */
const COLLECTION_LIST_ROUTES: Record<string, string> = {
  "api::promotion-card.promotion-card": "/promotions",
};

/**
 * Все страничные ISR-адреса (не зависящие от slug) — для полного сброса.
 * Выводится из `SINGLE_TYPE_ROUTES`, а не пишется вторым списком: иначе при добавлении
 * страницы её пришлось бы вписать дважды, и забытая строка означала бы, что полный сброс
 * её молча не трогает.
 */
export const STATIC_ISR_ROUTES: string[] = [
  ...new Set(Object.values(SINGLE_TYPE_ROUTES)),
];

/**
 * Пути, которые нужно перегенерировать после события вебхука.
 *
 * Переименование slug даёт ДВА пути: новый адрес нужно построить, а старый — убрать из
 * кеша, иначе прежний URL продолжит отдавать страницу из статики.
 */
export const pathsForEntry = (
  uid: string | null | undefined,
  entry?: EntryLike | null,
): string[] => {
  if (!uid) return [];

  const paths = new Set<string>();

  const singleTypeRoute = SINGLE_TYPE_ROUTES[uid];
  if (singleTypeRoute) paths.add(singleTypeRoute);

  const listRoute = COLLECTION_LIST_ROUTES[uid];
  if (listRoute) paths.add(listRoute);

  const baseRoute = DETAIL_ROUTES[uid];

  if (baseRoute) {
    const slug = asSlug(entry?.slug);
    if (slug) paths.add(`${baseRoute}/${slug}`);

    const previousSlug = asSlug(entry?.previousSlug);
    if (previousSlug) paths.add(`${baseRoute}/${previousSlug}`);
  }

  return [...paths];
};

/**
 * Страховочный интервал ревалидации ISR-страниц.
 *
 * Основной механизм обновления — вебхук; этот интервал нужен на случай, когда вебхук не
 * дошёл: упала сеть, перезапустили контейнер, кто-то выключил хук в админке. Без него
 * пропущенный вебхук означал бы вечное протухание.
 */
export const ISR_REVALIDATE_SECONDS = 60 * 60;

// ── 2. Вебхук ────────────────────────────────────────────────────────────────

type RevalidateBody = {
  event?: string;
  model?: string;
  uid?: string;
  entry?: EntryLike | null;
  tags?: string[];
  paths?: string[];
  all?: boolean;
};

/**
 * Перегенерация ISR-страниц.
 *
 * `allSettled`, а не `all`: путь мог быть удалён или ещё ни разу не собран, и отказ по
 * одному адресу не должен отменять остальные.
 */
const revalidatePaths = async (
  res: NextApiResponse,
  paths: string[],
): Promise<{ revalidated: string[]; failed: string[] }> => {
  const results = await Promise.allSettled(
    paths.map((path) => res.revalidate(path)),
  );

  const revalidated: string[] = [];
  const failed: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      revalidated.push(paths[index]);
      return;
    }

    failed.push(paths[index]);
    console.error(
      `[revalidate] путь "${paths[index]}" не перегенерирован:`,
      result.reason,
    );
  });

  return { revalidated, failed };
};

/** Сравнение секретов без утечки времени: `===` уязвим к тайминг-атаке. */
const isSecretValid = (provided: string | null, expected: string): boolean => {
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
};

/**
 * Сброс кеша по вебхуку из Strapi. Код на стороне Strapi не нужен — только настройка
 * в админке (Settings → Webhooks): POST на `/api/revalidate`, заголовок
 * `x-revalidate-secret`, события entry create/update/delete/publish/unpublish.
 *
 * Помимо штатного payload (`{ event, model, uid, entry }`) принимает ручные формы:
 * `{ tags: [...] }`, `{ paths: ["/..."] }`, `{ all: true }`.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const expected = process.env.REVALIDATE_SECRET;

  if (!expected) {
    console.error("[revalidate] REVALIDATE_SECRET не задан — сброс отклонён");
    res.status(500).json({ message: "Revalidation is not configured" });
    return;
  }

  const headerSecret = req.headers["x-revalidate-secret"];
  const provided =
    (Array.isArray(headerSecret) ? headerSecret[0] : headerSecret) ??
    (typeof req.query.secret === "string" ? req.query.secret : null);

  if (!isSecretValid(provided ?? null, expected)) {
    res.status(401).json({ message: "Invalid token" });
    return;
  }

  const body = (req.body ?? {}) as RevalidateBody;

  // Полный сброс: кеш данных ПЛЮС все ISR-страницы. Ручной инструмент — дёргать на каждое
  // изменение не стоит. Если сбросить только данные, статика останется прежней до часовой
  // ревалидации, и «полный сброс» сделает половину работы (заметить это можно лишь по тому,
  // что правка в CMS всё равно не появляется).
  if (body.all) {
    const removed = invalidateAll();
    const { revalidated, failed } = await revalidatePaths(
      res,
      STATIC_ISR_ROUTES,
    );

    res.status(200).json({
      revalidated: true,
      removed,
      tags: ALL_TAGS,
      paths: revalidated,
      failedPaths: failed,
    });
    return;
  }

  // Strapi присылает либо uid, либо model — нормализуем к uid.
  const uid =
    body.uid ?? (body.model ? `api::${body.model}.${body.model}` : undefined);

  let tags: CacheTag[];

  if (Array.isArray(body.tags) && body.tags.length > 0) {
    const allowed = new Set<string>(ALL_TAGS);
    tags = body.tags.filter((tag): tag is CacheTag => allowed.has(tag));

    if (tags.length === 0) {
      res.status(400).json({ message: "Unknown tags", tags: body.tags });
      return;
    }
  } else {
    tags = tagsForModel(uid);
  }

  // ⚠️ ПОРЯДОК: сначала теги. Регенерация страниц читает данные через тот же LRU, и до его
  // сброса записала бы в статику ровно то, что мы пытаемся обновить.
  const removed = invalidateTags(tags);

  // Дедупликация: правка одной записи может дать несколько источников путей
  // (текущий и прежний slug, ручной список).
  const paths = [
    ...new Set([
      ...pathsForEntry(uid, body.entry),
      ...(Array.isArray(body.paths) ? body.paths : []).filter(
        (path): path is string =>
          typeof path === "string" && path.startsWith("/"),
      ),
    ]),
  ];

  const { revalidated, failed } = await revalidatePaths(res, paths);

  console.log(
    `[revalidate] event=${body.event ?? "manual"} model=${uid ?? "-"} tags=[${tags.join(", ")}] removed=${removed} paths=[${revalidated.join(", ")}]`,
  );

  res.status(200).json({
    revalidated: true,
    removed,
    tags,
    paths: revalidated,
    failedPaths: failed,
  });
}
