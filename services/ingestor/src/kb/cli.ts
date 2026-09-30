import { pruneCircularsBefore, pruneKnowledge } from "../db/kb-chunks.js";
import { migrate } from "../db/migrate.js";
import { pool } from "../db/pool.js";
import { logger } from "../logger.js";
import { type IndexResult, indexDocument } from "./indexer.js";
import { fetchCircularArchive } from "./sources/circulars.js";
import { readKnowledge } from "./sources/knowledge.js";
import type { KbDocument } from "./types.js";

/**
 * Полная (пере)индексация базы знаний: статьи из knowledge/ и архив циркуляров.
 * Идемпотентна — неизменённые документы пропускаются, поэтому прерванный прогон
 * просто запускается заново. Ошибка Ollama или БД роняет прогон целиком: она
 * системная, и тысяча одинаковых warning'ов в логе ничем не лучше.
 *
 *   dev:  pnpm --filter ingestor kb:index
 *   прод: запускается фоном на каждом деплое (.github/workflows/deploy.yml), вручную —
 *         docker compose exec ingestor node services/ingestor/dist/kb/cli.js
 */
const CIRCULARS_YEARS = 3;
const PROGRESS_EVERY = 500;

const stats: Record<IndexResult, number> = { indexed: 0, unchanged: 0 };
const startedAt = Date.now();

const index = async (document: KbDocument) => {
  stats[await indexDocument(document)] += 1;

  const total = stats.indexed + stats.unchanged;

  if (total % PROGRESS_EVERY === 0) {
    logger.info("kb:index: прогресс", {
      ...stats,
      seconds: Math.round((Date.now() - startedAt) / 1000),
    });
  }
};

const run = async () => {
  await migrate();

  const articles = await readKnowledge();

  for (const article of articles) {
    await index(article);
  }

  const removedArticles = await pruneKnowledge(
    articles.map((article) => article.sourceId),
  );

  const since = new Date();
  since.setFullYear(since.getFullYear() - CIRCULARS_YEARS);

  for await (const circular of fetchCircularArchive({ since })) {
    await index(circular);
  }

  const removedCircularChunks = await pruneCircularsBefore(since);

  logger.info("kb:index: готово", {
    ...stats,
    removedArticles,
    removedCircularChunks,
    seconds: Math.round((Date.now() - startedAt) / 1000),
  });
};

run()
  .catch((error) => {
    logger.error("kb:index упал", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => pool.end());
