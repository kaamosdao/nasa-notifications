"use client";

import { useEffect, useRef } from "react";
import { useHeroActions, useHeroPhase } from "@widgets/hero-metaballs";
import clsx from "clsx";
import { gsap } from "gsap";

import { SplitText } from "@shared/ui/split-text";
import { prefersReducedMotion } from "@shared/utils/prefers-reduced-motion";

import { useHeroHotkeys } from "./lib/use-hero-hotkeys";

import s from "./hero-intro.module.scss";

export type HeroIntroProps = {
  className?: string;
};

const TITLE = "NASA · GCN";

/**
 * Текстовый слой intro. Живёт в layout рядом с канвасом: сама фаза общая, а перерисовывать
 * заголовок при переходе на другой маршрут незачем.
 *
 * Таймлайн не один общий на все слои, а свой у каждого (тут — текст, в ленте — карточки):
 * слои монтируются независимо, а общий `.reverse()` требовал бы, чтобы к моменту сборки
 * таймлайна в DOM были и заголовок, и уже отрисованные карточки. Согласование — по фазе
 * в сторе, обрыв на полпути гасится `overwrite: "auto"`.
 */
export const HeroIntro = ({ className }: HeroIntroProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  const phase = useHeroPhase();
  const { setPhase } = useHeroActions();

  useHeroHotkeys();

  const isFirstRun = useRef(true);

  useEffect(() => {
    const root = rootRef.current;
    const rest: HTMLElement[] = [subtitleRef.current, actionRef.current].filter(
      (el) => el !== null,
    );

    if (!root) {
      return;
    }

    const chars = gsap.utils.toArray<HTMLElement>(
      root.querySelectorAll(".char"),
    );
    const isBackground = phase === "background";
    const isFirst = isFirstRun.current;
    isFirstRun.current = false;

    if (prefersReducedMotion()) {
      gsap.set(root, { autoAlpha: isBackground ? 0 : 1 });
      gsap.set([...chars, ...rest], { yPercent: 0, y: 0, opacity: 1 });
      return;
    }

    const tl = gsap.timeline({ defaults: { overwrite: "auto" } });

    if (isBackground) {
      tl.set(root, { autoAlpha: 1 })
        .to(chars, {
          yPercent: -110,
          opacity: 0,
          duration: 0.5,
          ease: "power3.in",
          stagger: 0.012,
        })
        .to(
          rest,
          { y: -16, opacity: 0, duration: 0.35, ease: "power2.in" },
          "<0.05",
        )
        // Слой снимаем с потока только после ухода текста: иначе он мигает и исчезает разом.
        .set(root, { autoAlpha: 0 });
    } else {
      tl.set(root, { autoAlpha: 1 })
        .fromTo(
          chars,
          { yPercent: 110, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.02,
            delay: isFirst ? 0.2 : 0,
          },
        )
        .fromTo(
          rest,
          { y: 16, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            ease: "power2.out",
            stagger: 0.08,
          },
          "<0.25",
        );
    }

    return () => {
      tl.kill();
    };
  }, [phase]);

  return (
    <div
      ref={rootRef}
      className={clsx(s.root, className)}
      // Скрытый слой не должен ловить фокус табом, пока лента открыта.
      inert={phase === "background"}
    >
      <div className={s.inner}>
        <h1 className={s.title}>
          <SplitText type="char">{TITLE}</SplitText>
        </h1>

        <p ref={subtitleRef} className={s.subtitle}>
          Поток научных оповещений в реальном времени: гравитационные волны,
          гамма-всплески, нейтрино и циркуляры.
        </p>

        <div ref={actionRef} className={s.action}>
          <button
            type="button"
            className={s.button}
            onClick={() => setPhase("background")}
          >
            Открыть поток
          </button>
        </div>
      </div>
    </div>
  );
};

HeroIntro.displayName = "HeroIntro";
