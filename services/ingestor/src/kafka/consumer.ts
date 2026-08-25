import { Kafka } from "gcn-kafka";
import type { Admin, Consumer } from "kafkajs";

import { config } from "../config.js";
import { logger } from "../logger.js";

const kafka = new Kafka({
  client_id: config.gcn.clientId,
  client_secret: config.gcn.clientSecret,
});

/** Топики подписываем по одному: часть из них может быть недоступна аккаунту. */
const subscribeAll = async (consumer: Consumer) => {
  const subscribed: string[] = [];

  for (const topic of config.gcn.topics) {
    try {
      await consumer.subscribe({ topic, fromBeginning: false });
      subscribed.push(topic);
    } catch (error) {
      logger.warn("Топик недоступен, пропускаем", {
        topic,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!subscribed.length) {
    throw new Error(
      "Ни один топик не доступен — проверь GCN_CLIENT_ID / GCN_CLIENT_SECRET",
    );
  }

  logger.info("Подписка оформлена", { topics: subscribed });
};

/** Партиции, по которым у группы ещё нет коммита: kafkajs отдаёт для них offset "-1". */
const findFreshPartitions = async (
  admin: Admin,
  assignment: Record<string, number[]>,
) => {
  const committed = await admin.fetchOffsets({
    groupId: config.gcn.groupId,
    topics: Object.keys(assignment),
  });

  return committed.flatMap(({ topic, partitions }) =>
    partitions
      .filter(
        ({ partition, offset }) =>
          offset === "-1" && assignment[topic]?.includes(partition),
      )
      .map(({ partition }) => ({ topic, partition })),
  );
};

/**
 * Catch-up при старте: GCN хранит сообщения ~30 дней, но лента должна быть непустой
 * сразу — иначе ждём часами, пока что-нибудь прилетит. На партициях без коммита
 * (первый запуск группы) отматываем на `now - GCN_BACKFILL_DAYS`.
 * Heartbeat-топик всегда смотрит в конец: его история бессмысленна.
 */
const seekBackfill = async (
  consumer: Consumer,
  admin: Admin,
  assignment: Record<string, number[]>,
) => {
  const fresh = await findFreshPartitions(admin, assignment);
  const backfillFrom =
    Date.now() - config.gcn.backfillDays * 24 * 60 * 60 * 1000;

  for (const [topic, partitions] of Object.entries(assignment)) {
    if (topic === config.heartbeatTopic) {
      const latest = await admin.fetchTopicOffsets(topic);

      for (const { partition, offset } of latest) {
        if (partitions.includes(partition)) {
          consumer.seek({ topic, partition, offset });
        }
      }

      continue;
    }

    const target = fresh.filter((item) => item.topic === topic);

    if (!target.length) {
      continue;
    }

    const offsets = await admin.fetchTopicOffsetsByTimestamp(
      topic,
      backfillFrom,
    );

    for (const { partition, offset } of offsets) {
      if (target.some((item) => item.partition === partition)) {
        consumer.seek({ topic, partition, offset });
      }
    }

    logger.info("Catch-up: отматываем партиции на начало окна", {
      topic,
      days: config.gcn.backfillDays,
      partitions: target.map((item) => item.partition),
    });
  }
};

export const createGcnConsumer = () => {
  const consumer = kafka.consumer({ groupId: config.gcn.groupId });
  const admin = kafka.admin();

  return {
    consumer,
    connect: async () => {
      await admin.connect();
      await consumer.connect();
      await subscribeAll(consumer);
    },
    /**
     * Вешается до `run()`: seek разрешён только на назначенных партициях,
     * а назначение известно лишь после присоединения к группе.
     */
    onGroupJoin: () => {
      consumer.on(consumer.events.GROUP_JOIN, ({ payload }) => {
        seekBackfill(consumer, admin, payload.memberAssignment).catch(
          (error) => {
            logger.error("Catch-up не удался, продолжаем в live-режиме", {
              error: error instanceof Error ? error.message : String(error),
            });
          },
        );
      });
    },
    disconnect: async () => {
      await consumer.disconnect();
      await admin.disconnect();
    },
  };
};
