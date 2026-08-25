"use client";

import { useEffect, useRef, useState } from "react";
import { usePerformanceStore } from "@widgets/performance-detect";
import clsx from "clsx";

import { mod } from "@shared/utils/css-mods";
import { prefersReducedMotion } from "@shared/utils/prefers-reduced-motion";

import { HeroRenderer, isWebgl2Supported } from "./lib/renderer";
import { useHeroPhase } from "./model/hero-store";

import s from "./hero-metaballs.module.scss";

export type HeroMetaballsProps = {
  className?: string;
};

/**
 * Канвас живёт в layout, выше страницы в дереве: при переходе intro → background
 * WebGL-контекст не пересоздаётся (иначе фриз и мигание на каждой смене фазы).
 */
export const HeroMetaballs = ({ className }: HeroMetaballsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HeroRenderer | null>(null);

  const phase = useHeroPhase();
  const performanceIndex = usePerformanceStore(
    (state) => state.performanceIndex,
  );

  /** На сервере WebGL не проверить — до монтирования рисуем постер. */
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isWebgl2Supported()) return;

    try {
      rendererRef.current = new HeroRenderer({
        canvas,
        reducedMotion: prefersReducedMotion(),
      });
      setIsSupported(true);
    } catch (error) {
      console.error(error);
      return;
    }

    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
      setIsSupported(false);
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setPhase(phase);
  }, [phase]);

  useEffect(() => {
    rendererRef.current?.setPerformanceIndex(performanceIndex);
  }, [performanceIndex]);

  return (
    <div className={clsx(s.root, mod(s, { phase }), className)} aria-hidden>
      {/* Постер остаётся под канвасом: он же фолбэк, если WebGL2 недоступен. */}
      <div className={s.poster} />
      <canvas
        ref={canvasRef}
        className={clsx(s.canvas, isSupported && s.visible)}
      />
    </div>
  );
};

HeroMetaballs.displayName = "HeroMetaballs";
