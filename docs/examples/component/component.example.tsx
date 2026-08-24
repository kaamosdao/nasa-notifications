// Эталонный React-компонент проекта (для AI-контекста).
// Живой аналог в коде: src/shared/ui/styled-button/styled-button.tsx
//
// Соглашения, которые демонстрирует этот файл:
//  1. "use client" ставится, если есть хуки/обработчики/браузерные API.
//     ВАЖНО: проект на Pages Router, RSC здесь нет — директива фактически
//     декоративна, но её ставят для явности «клиентской» природы компонента.
//  2. Пропсы — через `type` (не interface), имя `<Component>Props`, всегда `export`.
//     Расширяем нативные атрибуты через ComponentProps<"tag">.
//  3. Компонент — стрелочная функция в `const`, named export (без default).
//  4. Классы-модификаторы собираются утилитой `mod(styles, {...})` и склеиваются
//     через `clsx`. Значения модификаторов ДОЛЖНЫ совпадать с именами SCSS-классов
//     (см. companion-файл component.example.module.scss).
//  5. В конце — обязательный `displayName`.
//  6. Порядок импортов задан biome (organizeImports): react → пакеты → @entities →
//     @/@shared → относительные → *.module.scss последними.
//
// Публичный API слайса объявляется в index.ts рядом:
//   export type { ExampleButtonProps } from "./component.example";
//   export { ExampleButton } from "./component.example";

"use client";

import { type ComponentProps, useMemo } from "react";
import clsx from "clsx";

import type { ElementSize } from "@shared/types";
import { mod } from "@shared/utils/css-mods";

import s from "./component.example.module.scss";

export type ExampleButtonProps = ComponentProps<"button"> & {
  className?: string;
  /** Визуальный вариант — маппится в SCSS-класс `.variant &Primary/&Secondary/...` */
  variant?: "primary" | "secondary";
  /** Размер — маппится в `.size &S/&M/&L` */
  size?: ElementSize;
  /** Цветовая схема — маппится в `.colorScheme &Light/&Dark` */
  colorScheme?: "light" | "dark";
};

export const ExampleButton = (props: ExampleButtonProps) => {
  const {
    className,
    children,
    variant = "primary",
    size = "m",
    colorScheme = "light",
    disabled,
    ...rest // ref и остальные нативные пропсы пробрасываем через ...rest (forwardRef не используется)
  } = props;

  // mod(s, { variant, size, colorScheme }) → ["variant", "variantPrimary", "size", "sizeM", ...]
  // отфильтрованные через styles[...]. Ключи-значения должны совпадать с классами в .module.scss.
  const mods = mod(s, { variant, size, colorScheme });

  const label = useMemo(
    () => (typeof children === "string" ? children.trim() : children),
    [children],
  );

  return (
    <button
      type="button"
      disabled={disabled}
      className={clsx(s.root, mods, className)}
      {...rest}
    >
      <span className={s.body}>{label}</span>
    </button>
  );
};

ExampleButton.displayName = "ExampleButton";
