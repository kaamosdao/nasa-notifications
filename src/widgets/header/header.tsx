"use client";

import type { ComponentProps } from "react";
import { useHeroActions, useHeroPhase } from "@widgets/hero-metaballs";
import clsx from "clsx";

import s from "./header.module.scss";

export type HeaderProps = ComponentProps<"div"> & {
  className?: string;
};

export const Header = (props: HeaderProps) => {
  const { className } = props;

  const phase = useHeroPhase();
  const { setPhase } = useHeroActions();

  const isBackground = phase === "background";

  return (
    <header className={clsx(s.root, className)}>
      <span className={s.mark}>NASA · GCN</span>

      {/*
        Кнопка не размонтируется, а гаснет: иначе на каждом переходе фокус слетал бы
        с исчезнувшего элемента на body.
      */}
      <button
        type="button"
        className={clsx(s.back, isBackground && s.visible)}
        onClick={() => setPhase("intro")}
        inert={!isBackground}
      >
        ↑ К началу <span className={s.hint}>Esc</span>
      </button>
    </header>
  );
};

Header.displayName = "Header";
