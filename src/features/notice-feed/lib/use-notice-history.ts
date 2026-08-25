"use client";

import { useCallback, useEffect, useRef } from "react";

import { fetchNotices } from "../api/fetch-notices";
import {
  useNoticeFeed,
  useNoticeFeedActions,
  useNoticeFeedApi,
} from "../model/feed-provider";

export type UseNoticeHistoryResult = {
  loadOlder: () => Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
};

/** Подгрузка истории вверх: одна страница за раз, повторный вызов во время запроса игнорируется. */
export const useNoticeHistory = (): UseNoticeHistoryResult => {
  const store = useNoticeFeedApi();
  const hasMore = useNoticeFeed((state) => state.nextCursor !== null);
  const isLoading = useNoticeFeed((state) => state.isLoadingHistory);
  const { prependHistory, setLoadingHistory } = useNoticeFeedActions();

  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadOlder = useCallback(async () => {
    // Курсор берём из стора, а не из замыкания: коллбэк живёт в IntersectionObserver.
    const before = store.getState().nextCursor;

    if (inFlight.current || !before) {
      return;
    }

    inFlight.current = true;
    setLoadingHistory(true);
    abortRef.current = new AbortController();

    try {
      prependHistory(
        await fetchNotices({ before, signal: abortRef.current.signal }),
      );
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("[feed] не удалось подгрузить историю:", error);
      }
    } finally {
      inFlight.current = false;
      setLoadingHistory(false);
    }
  }, [prependHistory, setLoadingHistory, store]);

  return { loadOlder, hasMore, isLoading };
};
