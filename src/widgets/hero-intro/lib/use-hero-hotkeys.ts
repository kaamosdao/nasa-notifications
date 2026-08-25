import { useEffect } from "react";
import { useHeroActions, useHeroStore } from "@widgets/hero-metaballs";

/**
 * Esc возвращает hero на весь экран. Фазу берём из `getState()`, а не из подписки —
 * иначе слушатель переподключался бы на каждую смену фазы.
 */
export const useHeroHotkeys = (): void => {
  const { setPhase } = useHeroActions();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || useHeroStore.getState().phase === "intro") {
        return;
      }

      setPhase("intro");
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setPhase]);
};
