import type { NextApiRequest, NextApiResponse } from "next";

import {
  getNoticeById,
  getNoticesAfter,
  type Notice,
  subscribeToNotices,
} from "@shared/api/db";

export const config = {
  api: {
    bodyParser: false,
    // Ответ бесконечный — лимит на размер тела оборвал бы поток.
    responseLimit: false,
  },
};

/** Прокси рвут «молчащее» соединение; комментарий-пинг держит его живым. */
const PING_INTERVAL = 15_000;

/**
 * SSE-поток новых оповещений.
 *
 * В `NOTIFY` приходит только id — строку добираем `SELECT`'ом. Доборы сериализованы через
 * цепочку промисов: параллельные запросы вернулись бы вразнобой и порядок в ленте поехал.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).end();

    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // nginx буферизует ответы по умолчанию — без этого события идут пачками с задержкой.
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const send = (notice: Notice) => {
    res.write(
      `id: ${notice.id}\nevent: notice\ndata: ${JSON.stringify(notice)}\n\n`,
    );
  };

  let closed = false;
  let queue: Promise<void> = Promise.resolve();

  const enqueue = (task: () => Promise<void>) => {
    queue = queue.then(async () => {
      if (closed) {
        return;
      }

      try {
        await task();
      } catch (error) {
        console.error("[api/stream]", error);
      }
    });
  };

  // Пропуск за время обрыва: браузер присылает id последнего доставленного события.
  const lastEventId = req.headers["last-event-id"];

  if (typeof lastEventId === "string" && /^\d+$/.test(lastEventId)) {
    enqueue(async () => {
      for (const notice of await getNoticesAfter(lastEventId)) {
        send(notice);
      }
    });
  }

  res.write(": connected\n\n");

  const unsubscribe = subscribeToNotices((id) => {
    enqueue(async () => {
      const notice = await getNoticeById(id);

      if (notice) {
        send(notice);
      }
    });
  });

  const ping = setInterval(() => {
    res.write(": ping\n\n");
  }, PING_INTERVAL);

  req.on("close", () => {
    closed = true;
    clearInterval(ping);
    unsubscribe();
    res.end();
  });
}
