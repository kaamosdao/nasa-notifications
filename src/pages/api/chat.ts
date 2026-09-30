import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import {
  buildMessages,
  chatRequestSchema,
  consumeChatQuota,
  retrieveContext,
  SYSTEM_PROMPT,
  toSources,
} from "@shared/api/chat";
import { getNoticeWithPayload } from "@shared/api/db";
import { getLlmProvider, type LlmProvider } from "@shared/api/llm";

export const config = {
  api: {
    // вопрос ≤ 1000 символов + история ≤ 10 реплик — с запасом
    bodyParser: { sizeLimit: "128kb" },
    responseLimit: false,
  },
};

type ErrorBody = { error: string };

/** За nginx реальный адрес клиента — в X-Real-IP; без прокси (dev) — адрес сокета. */
const getClientIp = (req: NextApiRequest) => {
  const header = req.headers["x-real-ip"];

  return (
    (typeof header === "string" && header) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

const LIMIT_MESSAGES = {
  minute: "Too many questions. Please wait a minute.",
  day: "You have reached the daily limit of questions. Please come back tomorrow.",
  cap: "The assistant has reached its daily limit. Please come back tomorrow.",
} as const;

/**
 * AI-чат по notice (docs/16-ai-chat.md). Ошибки до начала ответа — JSON со статусом,
 * дальше — SSE: `sources` → `delta`* → `done`, либо `error`.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorBody>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });

    return;
  }

  const parsed = chatRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: z.prettifyError(parsed.error) });

    return;
  }

  let llm: LlmProvider;
  let context: Awaited<ReturnType<typeof getNoticeWithPayload>>;

  try {
    llm = getLlmProvider();
    context = await getNoticeWithPayload(parsed.data.noticeId);
  } catch (error) {
    console.error("[api/chat]", error);
    res.status(503).json({ error: "The assistant is unavailable right now." });

    return;
  }

  if (!context) {
    res.status(404).json({ error: "Notice not found." });

    return;
  }

  // Квота списывается только за запрос, который реально дойдёт до модели
  const quota = consumeChatQuota(getClientIp(req));

  if (!quota.ok) {
    res.setHeader("Retry-After", String(quota.retryAfter));
    res.status(429).json({ error: LIMIT_MESSAGES[quota.reason] });

    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // nginx буферизует ответы по умолчанию — токены пришли бы одной пачкой в конце
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Клиент закрыл модалку — останавливаем генерацию, иначе платим за ответ в никуда.
  // Именно `res`: `close` у `req` с bodyParser срабатывает сразу после чтения тела.
  const controller = new AbortController();

  res.on("close", () => {
    if (!res.writableFinished) {
      controller.abort();
    }
  });

  try {
    const { notice, payload } = context;
    const { messages } = parsed.data;
    const chunks = await retrieveContext({
      notice,
      question: messages.at(-1)?.content ?? "",
      signal: controller.signal,
    });

    send("sources", toSources(chunks));

    for await (const text of llm.streamChat({
      system: SYSTEM_PROMPT,
      messages: buildMessages({ notice, payload, chunks, messages }),
      signal: controller.signal,
    })) {
      send("delta", { text });
    }

    send("done", {});
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }

    console.error("[api/chat]", error);
    send("error", {
      error: "The assistant failed to answer. Please try again.",
    });
  } finally {
    res.end();
  }
}
