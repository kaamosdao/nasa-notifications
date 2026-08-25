"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  useNoticeFeed,
  useNoticeFeedActions,
  useNoticeFeedApi,
  useNoticeHistory,
  useNoticeStream,
} from "@features/notice-feed";
import clsx from "clsx";
import { gsap } from "gsap";

import { NoticeCard } from "@entities/notice";

import s from "./notice-feed.module.scss";

/** Дальше этого от низа считаем, что пользователь читает историю, и ленту не дёргаем. */
const BOTTOM_THRESHOLD = 120;

const ENTER_DURATION = 0.5;
const ENTER_EASE = "power2.out";

const pluralRules = new Intl.PluralRules("ru-RU");

const PENDING_FORMS: Record<Intl.LDMLPluralRule, string> = {
  one: "новое событие",
  few: "новых события",
  many: "новых событий",
  two: "новых события",
  zero: "новых событий",
  other: "новых событий",
};

const CONNECTION_LABELS = {
  connecting: "подключение",
  live: "live",
  offline: "нет связи",
} as const;

export type NoticeFeedProps = {
  className?: string;
};

export const NoticeFeed = (props: NoticeFeedProps) => {
  const { className } = props;

  const store = useNoticeFeedApi();
  const items = useNoticeFeed((state) => state.items);
  const pendingCount = useNoticeFeed((state) => state.pendingCount);
  const connection = useNoticeFeed((state) => state.connection);
  const { pushLive, setConnection, resetPending } = useNoticeFeedActions();
  const { loadOlder, hasMore, isLoading } = useNoticeHistory();

  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const isAtBottom = useRef(true);
  /** id, для которых анимация входа уже отыграна (или не нужна — SSR и история). */
  const settledIds = useRef(new Set<string>());
  const prevFirstId = useRef<string | null>(null);
  const prevScrollHeight = useRef(0);
  const isMounted = useRef(false);

  useNoticeStream({
    onNotices: useCallback(
      (notices) => pushLive(notices, { isAtBottom: isAtBottom.current }),
      [pushLive],
    ),
    onStatus: setConnection,
  });

  const scrollToBottom = useCallback((animated: boolean) => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    if (!animated) {
      container.scrollTop = container.scrollHeight;
      return;
    }

    gsap.to(container, {
      scrollTop: container.scrollHeight,
      duration: ENTER_DURATION,
      ease: ENTER_EASE,
      overwrite: "auto",
    });
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    const distance =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isAtBottom.current = distance <= BOTTOM_THRESHOLD;

    if (isAtBottom.current && store.getState().pendingCount) {
      resetPending();
    }
  }, [resetPending, store]);

  const handlePillClick = useCallback(() => {
    resetPending();
    isAtBottom.current = true;
    scrollToBottom(true);
  }, [resetPending, scrollToBottom]);

  /**
   * Вся работа со скроллом — здесь, до отрисовки кадра: подгруженная сверху история должна
   * компенсироваться в том же кадре, иначе лента прыгает на каждой странице.
   */
  useLayoutEffect(() => {
    const container = scrollRef.current;
    const list = listRef.current;

    if (!container || !list) {
      return;
    }

    const firstId = items[0]?.id ?? null;
    const isPrepend =
      isMounted.current && firstId !== null && firstId !== prevFirstId.current;

    const newNodes = Array.from(list.children).filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement &&
        Boolean(node.dataset.noticeId) &&
        !settledIds.current.has(node.dataset.noticeId as string),
    );

    if (!isMounted.current) {
      // Первый кадр: SSR-карточки уже на месте, лента открывается снизу — как мессенджер.
      isMounted.current = true;
      scrollToBottom(false);
    } else if (isPrepend) {
      container.scrollTop += container.scrollHeight - prevScrollHeight.current;
    } else if (newNodes.length) {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reduced) {
        if (isAtBottom.current) {
          scrollToBottom(false);
        }
      } else {
        gsap.fromTo(
          newNodes,
          { y: 24, opacity: 0, filter: "blur(6px)" },
          {
            y: 0,
            opacity: 1,
            filter: "blur(0px)",
            duration: ENTER_DURATION,
            ease: ENTER_EASE,
            stagger: 0.05,
            overwrite: "auto",
          },
        );

        // Тем же easing и одновременно — тогда читается как выталкивание, а не рывок.
        if (isAtBottom.current) {
          scrollToBottom(true);
        }
      }
    }

    for (const node of newNodes) {
      settledIds.current.add(node.dataset.noticeId as string);
    }

    prevFirstId.current = firstId;
    prevScrollHeight.current = container.scrollHeight;
  }, [items, scrollToBottom]);

  useEffect(() => {
    const container = scrollRef.current;
    const sentinel = sentinelRef.current;

    if (!container || !sentinel || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void loadOlder();
        }
      },
      { root: container, rootMargin: "200px 0px 0px 0px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, loadOlder]);

  useEffect(
    () => () => {
      if (listRef.current) {
        gsap.killTweensOf(listRef.current.children);
      }

      if (scrollRef.current) {
        gsap.killTweensOf(scrollRef.current);
      }
    },
    [],
  );

  return (
    <section className={clsx(s.root, className)}>
      <header className={s.head}>
        <h2 className={s.heading}>Поток GCN</h2>
        <span className={clsx(s.status, s[`status-${connection}`])}>
          {CONNECTION_LABELS[connection]}
        </span>
      </header>

      <div
        ref={scrollRef}
        className={s.scroll}
        onScroll={handleScroll}
        data-lenis-prevent
      >
        <div ref={listRef} className={s.list}>
          <div ref={sentinelRef} className={s.sentinel} aria-hidden />

          {hasMore && (
            <p className={s.hint}>
              {isLoading
                ? "Загружаем историю…"
                : "Прокрутите вверх за историей"}
            </p>
          )}

          {!items.length && (
            <p className={s.hint}>
              Ждём событий GCN — поток может молчать часами
            </p>
          )}

          {items.map((notice) => (
            <NoticeCard key={notice.id} notice={notice} />
          ))}
        </div>
      </div>

      {pendingCount > 0 && (
        <button type="button" className={s.pill} onClick={handlePillClick}>
          ↓ {pendingCount} {PENDING_FORMS[pluralRules.select(pendingCount)]}
        </button>
      )}
    </section>
  );
};

NoticeFeed.displayName = "NoticeFeed";
