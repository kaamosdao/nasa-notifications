import pg from "pg";

import { getConnectionString } from "./pool";

export const NOTICE_CHANNEL = "gcn_notice";

type Subscriber = (id: string) => void;

type ListenerState = {
  client: pg.Client | null;
  subscribers: Set<Subscriber>;
  connecting: Promise<void> | null;
  retryDelay: number;
  retryTimer: NodeJS.Timeout | null;
};

/**
 * Один `LISTEN gcn_notice` на процесс, мультиплексируемый в SSE-подписчиков.
 *
 * Отдельный клиент, а не соединение из пула: `LISTEN` живёт на конкретном коннекте, и
 * вернуть его в пул — значит потерять подписку. Состояние в globalThis по той же причине,
 * что и пул: hot-reload в dev иначе плодит слушателей.
 */
const globalForListener = globalThis as typeof globalThis & {
  __gcnListener?: ListenerState;
};

globalForListener.__gcnListener ??= {
  client: null,
  subscribers: new Set(),
  connecting: null,
  retryDelay: 1000,
  retryTimer: null,
};

const state: ListenerState = globalForListener.__gcnListener;

const MAX_RETRY_DELAY = 30_000;

const scheduleReconnect = () => {
  if (state.retryTimer || !state.subscribers.size) {
    return;
  }

  state.retryTimer = setTimeout(() => {
    state.retryTimer = null;
    void connect();
  }, state.retryDelay);

  state.retryDelay = Math.min(state.retryDelay * 2, MAX_RETRY_DELAY);
};

const teardown = (client: pg.Client) => {
  if (state.client === client) {
    state.client = null;
  }

  client.removeAllListeners();
  void client.end().catch(() => undefined);
};

const connect = async (): Promise<void> => {
  if (state.client) {
    return;
  }

  if (state.connecting) {
    return state.connecting;
  }

  state.connecting = (async () => {
    const client = new pg.Client({ connectionString: getConnectionString() });

    client.on("error", (error) => {
      console.error("[db:listener] соединение потеряно:", error);
      teardown(client);
      scheduleReconnect();
    });

    client.on("notification", (message) => {
      if (message.channel === NOTICE_CHANNEL && message.payload) {
        for (const subscriber of state.subscribers) {
          subscriber(message.payload);
        }
      }
    });

    try {
      await client.connect();
      await client.query(`listen ${NOTICE_CHANNEL}`);
      state.client = client;
      state.retryDelay = 1000;
    } catch (error) {
      console.error("[db:listener] не удалось подписаться:", error);
      teardown(client);
      scheduleReconnect();
    }
  })().finally(() => {
    state.connecting = null;
  });

  return state.connecting;
};

/**
 * Подписка на id новых оповещений.
 *
 * @returns функция отписки; после ухода последнего подписчика соединение закрывается.
 */
export const subscribeToNotices = (subscriber: Subscriber): (() => void) => {
  state.subscribers.add(subscriber);
  void connect();

  return () => {
    state.subscribers.delete(subscriber);

    if (state.subscribers.size) {
      return;
    }

    if (state.retryTimer) {
      clearTimeout(state.retryTimer);
      state.retryTimer = null;
    }

    if (state.client) {
      teardown(state.client);
    }
  };
};
