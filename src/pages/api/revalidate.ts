import type { NextApiRequest, NextApiResponse } from "next";

import {
  ALL_TAGS,
  CACHE_TAGS,
  type CacheTag,
  invalidateAll,
  invalidateTags,
  tagsForModel,
  toModelUid,
} from "@shared/api/cache";

import { timingSafeEqual } from "node:crypto";

/**
 * Сброс серверного кэша по вебхуку из Strapi.
 *
 * Настройка в админке (Settings → Webhooks), код на стороне Strapi не нужен:
 *   URL:     https://<домен-фронта>/api/revalidate
 *   Method:  POST
 *   Headers: Authorization: Bearer <REVALIDATE_SECRET>
 *   Events:  entry create / update / delete / publish / unpublish
 *
 * Принимает штатный payload (`{ event, model, uid }`) и ручные формы:
 *   `{ "tags": ["common"] }` — сбросить конкретные теги;
 *   `{}` (без `event` и без тегов) — полный сброс.
 *
 * Что чем сбрасывается — карта «модель → теги» в `src/shared/api/cache/tags.ts`. Неизвестная
 * модель сбрасывает всё: пропустить инвалидацию дороже, чем лишний раз перезапросить.
 */

/**
 * События, меняющие НАБОР публичных URL.
 *
 * Только они трогают тег `sitemap`: правка содержимого товара (`entry.update`) карту не меняет,
 * а её пересборка — обход коллекций, недешёвая операция.
 */
const URL_SET_EVENTS = new Set([
  "entry.create",
  "entry.delete",
  "entry.publish",
  "entry.unpublish",
]);

function readSecret(req: NextApiRequest): string | undefined {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  const fromQuery = req.query.secret;
  if (typeof fromQuery === "string") return fromQuery;

  const header = req.headers["x-revalidate-secret"];
  if (typeof header === "string") return header;

  return undefined;
}

/** Сравнение секретов без утечки времени: `===` уязвим к тайминг-атаке. */
function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type StrapiWebhookBody = {
  event?: string;
  model?: string;
  uid?: string;
  tags?: string[];
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    console.error("[revalidate] REVALIDATE_SECRET не задан — сброс отклонён");
    return res
      .status(500)
      .json({ message: "REVALIDATE_SECRET is not configured" });
  }

  const provided = readSecret(req);
  if (!provided || !secretsEqual(provided, expected)) {
    return res.status(401).json({ message: "Invalid token" });
  }

  const body = (req.body ?? {}) as StrapiWebhookBody;
  const event = typeof body.event === "string" ? body.event : "";

  // 1. Явные теги (ручной вызов) — приоритетнее карты моделей.
  if (Array.isArray(body.tags) && body.tags.length > 0) {
    const allowed = new Set<string>(ALL_TAGS);
    const tags = body.tags.filter((tag): tag is CacheTag => allowed.has(tag));

    if (tags.length === 0) {
      return res.status(400).json({ message: "Unknown tags", tags: body.tags });
    }

    const removed = invalidateTags(tags);
    console.log(
      `[revalidate] ручной сброс тегов [${tags.join(", ")}]: ${removed}`,
    );

    return res.status(200).json({ revalidated: removed > 0, tags, removed });
  }

  // 2. Ни события, ни тегов — полный сброс.
  if (!event) {
    const removed = invalidateAll();
    console.log(`[revalidate] полный сброс: ${removed}`);

    return res.status(200).json({ revalidated: true, tags: ALL_TAGS, removed });
  }

  // 3. Штатный вебхук: модель → теги.
  const uid = toModelUid(body.uid, body.model);
  const modelTags = tagsForModel(uid);

  // Карту сайта пересобираем только когда изменился набор URL, а не содержимое записи.
  const tags = URL_SET_EVENTS.has(event)
    ? modelTags
    : modelTags.filter((tag) => tag !== CACHE_TAGS.sitemap);

  const removed = invalidateTags(tags);

  console.log(
    `[revalidate] event=${event} model=${uid ?? "-"} tags=[${tags.join(", ")}] removed=${removed}`,
  );

  return res.status(200).json({
    revalidated: removed > 0,
    tags,
    removed,
    event,
    model: uid ?? null,
  });
}
