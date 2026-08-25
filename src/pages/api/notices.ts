import type { NextApiRequest, NextApiResponse } from "next";

import { clampLimit, getNotices, type NoticesPage } from "@shared/api/db";

type ErrorBody = { error: string };

/** История ленты, курсорная пагинация от новых к старым: `?before=<nextCursor>&limit=20`. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NoticesPage | ErrorBody>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method Not Allowed" });

    return;
  }

  const before = typeof req.query.before === "string" ? req.query.before : null;

  try {
    const page = await getNotices({
      before,
      limit: clampLimit(req.query.limit),
    });

    // История иммутабельна, но хвост ленты меняется каждую секунду — кэшировать нечего.
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(page);
  } catch (error) {
    console.error("[api/notices]", error);
    res
      .status(before ? 400 : 500)
      .json({ error: before ? "Некорректный курсор" : "Внутренняя ошибка" });
  }
}
