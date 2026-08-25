import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { insertNotices, type NoticeRecord, touchState } from "./db/notices.js";
import { pool } from "./db/pool.js";
import { createGcnConsumer } from "./kafka/consumer.js";
import { logger } from "./logger.js";
import { parseNotice } from "./parsers/index.js";

const gcn = createGcnConsumer();

const start = async () => {
  await migrate();
  await gcn.connect();
  gcn.onGroupJoin();

  await gcn.consumer.run({
    eachBatch: async ({
      batch,
      resolveOffset,
      heartbeat,
      isRunning,
      isStale,
    }) => {
      // Heartbeat-топик тикает раз в ~30 с и в БД не пишется: он только liveness-сигнал.
      if (batch.topic === config.heartbeatTopic) {
        for (const message of batch.messages) {
          resolveOffset(message.offset);
        }

        await touchState({ lastHeartbeatAt: new Date().toISOString() });
        await heartbeat();

        return;
      }

      const records: NoticeRecord[] = [];

      for (const message of batch.messages) {
        if (!isRunning() || isStale()) {
          break;
        }

        records.push({
          ...parseNotice(message.value?.toString("utf8") ?? "", batch.topic),
          topic: batch.topic,
          partition: batch.partition,
          offset: message.offset,
        });

        resolveOffset(message.offset);
      }

      const inserted = await insertNotices(records);

      if (inserted.length) {
        await touchState({ lastNoticeAt: new Date().toISOString() });
        logger.info("Записан батч", {
          topic: batch.topic,
          received: records.length,
          inserted: inserted.length,
        });
      }

      await heartbeat();
    },
  });

  await touchState({ startedAt: new Date().toISOString() });
  logger.info("Ingestor запущен", {
    groupId: config.gcn.groupId,
    backfillDays: config.gcn.backfillDays,
  });
};

/** Без явного disconnect ребалансировка группы висит до таймаута сессии. */
const shutdown = async (signal: string) => {
  logger.info("Останавливаемся", { signal });

  try {
    await gcn.disconnect();
    await pool.end();
  } catch (error) {
    logger.error("Ошибка при остановке", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  process.exit(0);
};

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

start().catch((error) => {
  logger.error("Ingestor не смог стартовать", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
