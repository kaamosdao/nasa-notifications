import { useEffect } from "react";
import { useHeroActions, useHeroStore } from "@widgets/hero-metaballs";

/**
 * Esc возвращает hero на весь экран. Фазу берём из `getState()`, а не из подписки —
 * иначе слушатель переподключался бы на каждую смену фазы.
 *
 * Пока открыт модальный диалог (AI-чат), Esc закрывает его, а не ленту: иначе лента уходит
 * под `inert` и фокусу после закрытия диалога некуда вернуться.
 */
export const useHeroHotkeys = (): void => {
  const { setPhase } = useHeroActions();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        useHeroStore.getState().phase === "intro" ||
        document.querySelector("dialog:modal")
      ) {
        return;
      }

      setPhase("intro");
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setPhase]);
};
