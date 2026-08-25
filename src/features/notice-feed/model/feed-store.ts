import { createStore } from "zustand/vanilla";

import type { Notice, NoticesPage } from "@entities/notice";

export type FeedConnection = "connecting" | "live" | "offline";

/**
 * Потолок карточек в DOM. Больше держать бессмысленно: верх ленты всё равно за экраном,
 * а каждая карточка — это backdrop-filter. Полноценная виртуализация — если понадобится.
 */
export const MAX_FEED_ITEMS = 500;

export type NoticeFeedState = {
  /** От старых к новым: лента ведёт себя как мессенджер, свежее — внизу. */
  items: Notice[];
  /** Курсор для подгрузки истории вверх; `null` — история кончилась. */
  nextCursor: string | null;
  isLoadingHistory: boolean;
  /** Сколько событий пришло, пока пользователь смотрел историю. */
  pendingCount: number;
  connection: FeedConnection;
  actions: {
    prependHistory: (page: NoticesPage) => void;
    pushLive: (notices: Notice[], options: { isAtBottom: boolean }) => void;
    setLoadingHistory: (value: boolean) => void;
    setConnection: (value: FeedConnection) => void;
    resetPending: () => void;
  };
};

export type NoticeFeedStore = ReturnType<typeof createNoticeFeedStore>;

/** Оба источника (SSR и SSE) могут принести одно и то же событие — сверяем по id. */
const withoutKnown = (items: Notice[], known: Notice[]): Notice[] => {
  const ids = new Set(known.map((item) => item.id));

  return items.filter((item) => !ids.has(item.id));
};

/**
 * Store создаётся на монтирование страницы и сразу с SSR-данными.
 *
 * Не модуль-синглтон: в zustand серверный снимок берётся из начального состояния, так что
 * наполнить синглтон перед рендером нельзя — SSR отдал бы пустую ленту. Плюс на сервере
 * модульный store был бы общим на все запросы.
 */
export const createNoticeFeedStore = (page: NoticesPage | null) =>
  createStore<NoticeFeedState>((set) => ({
    // Страница из getServerSideProps приходит от новых к старым — разворачиваем.
    items: page ? [...page.items].reverse() : [],
    nextCursor: page?.nextCursor ?? null,
    isLoadingHistory: false,
    pendingCount: 0,
    connection: "connecting",
    actions: {
      prependHistory: (historyPage) =>
        set((state) => ({
          items: [
            ...withoutKnown([...historyPage.items].reverse(), state.items),
            ...state.items,
          ],
          nextCursor: historyPage.nextCursor,
        })),

      pushLive: (notices, { isAtBottom }) =>
        set((state) => {
          const fresh = withoutKnown(notices, state.items);

          if (!fresh.length) {
            return state;
          }

          const items = [...state.items, ...fresh];

          return {
            // Обрезаем только когда пользователь внизу: иначе уедет позиция скролла.
            items:
              isAtBottom && items.length > MAX_FEED_ITEMS
                ? items.slice(-MAX_FEED_ITEMS)
                : items,
            pendingCount: isAtBottom ? 0 : state.pendingCount + fresh.length,
          };
        }),

      setLoadingHistory: (value) => set({ isLoadingHistory: value }),
      setConnection: (value) => set({ connection: value }),
      resetPending: () => set({ pendingCount: 0 }),
    },
  }));
