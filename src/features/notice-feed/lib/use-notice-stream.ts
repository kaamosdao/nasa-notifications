"use client";

import { useEffect, useRef } from "react";

import type { Notice } from "@entities/notice";

import type { FeedConnection } from "../model/feed-store";

/** GW-алерты приходят пачками — вставляем окном, а не по событию: иначе лента дёргается. */
const BATCH_WINDOW = 100;

const INITIAL_RETRY = 1000;
const MAX_RETRY = 15_000;

export type UseNoticeStreamOptions = {
  onNotices: (notices: Notice[]) => void;
  onStatus: (status: FeedConnection) => void;
};

/**
 * Подписка на `/api/stream`.
 *
 * Реконнект в основном делает сам `EventSource` — он же присылает `Last-Event-ID`, по которому
 * сервер доигрывает пропуск. Ручной ретрай нужен для случая, когда браузер счёл соединение
 * проваленным окончательно (`readyState === CLOSED`): например, сервер ответил 502 при рестарте.
 */
export const useNoticeStream = ({
  onNotices,
  onStatus,
}: UseNoticeStreamOptions): void => {
  const onNoticesRef = useRef(onNotices);
  const onStatusRef = useRef(onStatus);

  onNoticesRef.current = onNotices;
  onStatusRef.current = onStatus;

  useEffect(() => {
    let source: EventSource | null = null;
    let retryDelay = INITIAL_RETRY;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let buffer: Notice[] = [];
    let isStopped = false;

    const flush = () => {
      flushTimer = null;

      if (!buffer.length) {
        return;
      }

      const batch = buffer;
      buffer = [];
      onNoticesRef.current(batch);
    };

    const connect = () => {
      if (isStopped) {
        return;
      }

      onStatusRef.current("connecting");
      source = new EventSource("/api/stream");

      source.addEventListener("open", () => {
        retryDelay = INITIAL_RETRY;
        onStatusRef.current("live");
      });

      source.addEventListener("notice", (event) => {
        try {
          buffer.push(JSON.parse((event as MessageEvent<string>).data));
        } catch (error) {
          console.error("[feed] не разобрал событие потока:", error);
          return;
        }

        if (!flushTimer) {
          flushTimer = setTimeout(flush, BATCH_WINDOW);
        }
      });

      source.addEventListener("error", () => {
        onStatusRef.current("offline");

        // Браузер переподключится сам, только если соединение не закрыто окончательно.
        if (source?.readyState !== EventSource.CLOSED || isStopped) {
          return;
        }

        source.close();
        source = null;

        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY);
      });
    };

    connect();

    return () => {
      isStopped = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      if (flushTimer) {
        clearTimeout(flushTimer);
      }

      source?.close();
    };
  }, []);
};
