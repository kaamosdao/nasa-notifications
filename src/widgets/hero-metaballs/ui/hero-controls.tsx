"use client";

import { useEffect, useState } from "react";

import {
  HERO_CONTROL_FIELDS,
  HERO_CONTROLS_DEFAULTS,
  type HeroControls,
  useHeroControlsStore,
} from "../model/controls-store";

import s from "./hero-controls.module.scss";

const STORAGE_KEY = "hero-controls";

const GROUPS = ["Форма", "Вода", "Небо", "Анимация"] as const;

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Значения из localStorage — данные прошлой версии панели: набор ручек мог
 * измениться, поэтому берём из него только знакомые числа, остальное — дефолт.
 */
const readStored = (): HeroControls | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const stored = parsed as Record<string, unknown>;

    return HERO_CONTROL_FIELDS.reduce<HeroControls>(
      (acc, { key }) => {
        const value = stored[key];
        if (typeof value === "number" && Number.isFinite(value)) {
          acc[key] = value;
        }
        return acc;
      },
      { ...HERO_CONTROLS_DEFAULTS },
    );
  } catch {
    return null;
  }
};

/**
 * Панель подбора формы и анимации шара. Только для разработки: в проде не
 * рендерится, а найденные значения переносятся в `HERO_CONTROLS_DEFAULTS`.
 */
export const HeroControlsPanel = () => {
  const controls = useHeroControlsStore((state) => state.controls);
  const { setControl, setControls, reset } = useHeroControlsStore(
    (state) => state.actions,
  );

  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // localStorage читается после монтирования: на сервере его нет, и значения в
  // разметке разошлись бы с клиентскими.
  useEffect(() => {
    if (!IS_DEV) return;

    const stored = readStored();
    if (stored) setControls(stored);
  }, [setControls]);

  // Те же ручки из консоли: __hero.set({ blend: 0.8 }) — удобнее слайдеров, когда
  // значение уже известно, и единственный способ для скриптов и автотестов.
  useEffect(() => {
    if (!IS_DEV) return;

    Object.assign(window, {
      __hero: {
        get: () => useHeroControlsStore.getState().controls,
        set: (patch: Partial<HeroControls>) =>
          setControls({
            ...useHeroControlsStore.getState().controls,
            ...patch,
          }),
        reset,
      },
    });
  }, [setControls, reset]);

  useEffect(() => {
    if (!IS_DEV) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(controls));
    } catch {
      // Приватный режим — подбор просто не переживёт перезагрузку.
    }
  }, [controls]);

  if (!IS_DEV) return null;

  const handleCopy = () => {
    void navigator.clipboard.writeText(JSON.stringify(controls, null, 2));
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1200);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        className={s.toggle}
        onClick={() => setIsOpen(true)}
      >
        Шар
      </button>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.head}>
        <span className={s.title}>Шар</span>
        <button type="button" className={s.action} onClick={handleCopy}>
          {isCopied ? "Скопировано" : "Копировать"}
        </button>
        <button type="button" className={s.action} onClick={reset}>
          Сброс
        </button>
        <button
          type="button"
          className={s.action}
          onClick={() => setIsOpen(false)}
        >
          Свернуть
        </button>
      </div>

      {GROUPS.map((group) => (
        <fieldset key={group} className={s.group}>
          <legend className={s.legend}>{group}</legend>

          {HERO_CONTROL_FIELDS.filter((field) => field.group === group).map(
            ({ key, label, min, max, step }) => (
              <label key={key} className={s.field}>
                <span className={s.label}>{label}</span>
                <span className={s.value}>{controls[key]}</span>
                <input
                  type="range"
                  className={s.range}
                  min={min}
                  max={max}
                  step={step}
                  value={controls[key]}
                  onChange={(event) =>
                    setControl(key, Number(event.target.value))
                  }
                />
              </label>
            ),
          )}
        </fieldset>
      ))}
    </div>
  );
};

HeroControlsPanel.displayName = "HeroControlsPanel";
