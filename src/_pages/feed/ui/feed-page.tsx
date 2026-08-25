"use client";

import { useEffect, useRef } from "react";
import { usePageData } from "@app/model/data-store";
import { NoticeFeedProvider } from "@features/notice-feed";
import { useHeroPhase } from "@widgets/hero-metaballs";
import { NoticeFeed } from "@widgets/notice-feed";
import { gsap } from "gsap";

import type { NoticesPage } from "@entities/notice";

import { prefersReducedMotion } from "@shared/utils/prefers-reduced-motion";

import s from "./feed-page.module.scss";

export type FeedPageData = {
  noticesPage: NoticesPage | null;
};

export const FeedPage = () => {
  const { noticesPage } = usePageData<FeedPageData>();

  const rootRef = useRef<HTMLDivElement>(null);
  const phase = useHeroPhase();

  /**
   * Лента — второй слой того же перехода: своим таймлайном, согласованным по фазе.
   * Карточки ищем в момент запуска, а не при монтировании: их состав меняется потоком SSE.
   */
  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const isBackground = phase === "background";

    if (prefersReducedMotion()) {
      gsap.set(root, { autoAlpha: isBackground ? 1 : 0, y: 0 });
      return;
    }

    const tl = gsap.timeline({ defaults: { overwrite: "auto" } });

    if (isBackground) {
      const cards = gsap.utils.toArray<HTMLElement>(
        root.querySelectorAll("[data-notice-id]"),
      );

      tl.fromTo(
        root,
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out", delay: 0.25 },
      ).fromTo(
        cards,
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          ease: "power2.out",
          // Снизу вверх: свежие события ближе к низу, взгляд идёт за ними.
          stagger: { each: 0.04, from: "end" },
        },
        "<0.1",
      );
    } else {
      tl.to(root, { autoAlpha: 0, y: 16, duration: 0.35, ease: "power2.in" });
    }

    return () => {
      tl.kill();
    };
  }, [phase]);

  return (
    // `main` уже отрисован в `TransitionLayout` — второй landmark ломает навигацию скринридера.
    <div ref={rootRef} className={s.root} inert={phase === "intro"}>
      <NoticeFeedProvider page={noticesPage}>
        <NoticeFeed className={s.feed} />
      </NoticeFeedProvider>
    </div>
  );
};

FeedPage.displayName = "FeedPage";
