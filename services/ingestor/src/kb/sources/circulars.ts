import { extract } from "tar-stream";
import { z } from "zod";

import { logger } from "../../logger.js";
import type { KbDocument } from "../types.js";

import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";

/** Полный архив циркуляров, ~30 МБ tar.gz, NASA пересобирает его ежедневно. */
const ARCHIVE_URL = "https://gcn.nasa.gov/circulars/archive.json.tar.gz";

/** Та же форма, что у сообщений топика gcn.circulars. */
const circularSchema = z.object({
  // бывают дробные (18453.5) — вставки задним числом между соседними номерами
  circularId: z.number(),
  subject: z.string(),
  body: z.string(),
  createdOn: z.number(),
  eventId: z.string().nullish(),
});

/**
 * Циркуляр → документ базы знаний или null, если форма не та.
 * `submitter`/`email` намеренно не берём: персональные данные модели не нужны.
 */
export const toCircularDocument = (value: unknown): KbDocument | null => {
  const parsed = circularSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  const circular = parsed.data;

  return {
    source: "circular",
    sourceId: String(circular.circularId),
    kind: null,
    topics: [],
    eventName: circular.eventId || null,
    title: circular.subject,
    url: `https://gcn.nasa.gov/circulars/${circular.circularId}`,
    content: circular.body,
    publishedAt: new Date(circular.createdOn).toISOString(),
  };
};

const readEntry = async (entry: AsyncIterable<Buffer>): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of entry) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
};

/**
 * Скачивает архив и отдаёт циркуляры не старше `since`. Поток идёт насквозь:
 * gunzip и разбор tar на лету, на диск ничего не пишется, в памяти — один файл.
 */
export async function* fetchCircularArchive(options: {
  since: Date;
  signal?: AbortSignal;
}): AsyncGenerator<KbDocument> {
  const response = await fetch(ARCHIVE_URL, { signal: options.signal });

  if (!response.ok || !response.body) {
    throw new Error(`Архив циркуляров: HTTP ${response.status}`);
  }

  const since = options.since.getTime();
  const archive = extract();
  const source = Readable.fromWeb(
    response.body.pipeThrough(
      new DecompressionStream("gzip"),
    ) as ReadableStream<Uint8Array>,
  );

  // .pipe() не пробрасывает ошибки источника: без этого обрыв сети повесил бы цикл
  source.on("error", (error) => archive.destroy(error));
  source.pipe(archive);

  for await (const entry of archive) {
    const { name, type } = entry.header;

    if (type !== "file" || !name.endsWith(".json")) {
      entry.resume();
      continue;
    }

    let document: KbDocument | null = null;

    try {
      // типы streamx отдают чанки как unknown, по факту это Buffer
      const raw = await readEntry(entry as AsyncIterable<Buffer>);
      document = toCircularDocument(JSON.parse(raw));
    } catch {
      // битый JSON обрабатываем так же, как чужую форму — ниже
    }

    if (!document) {
      logger.warn("Циркуляр пропущен: неожиданный формат", { name });
      continue;
    }

    if (document.publishedAt && Date.parse(document.publishedAt) >= since) {
      yield document;
    }
  }
}
