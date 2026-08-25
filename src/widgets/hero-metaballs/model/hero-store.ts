import { create } from "zustand";

/** intro — hero на весь экран; background — уехал на задний план под ленту. */
export type HeroPhase = "intro" | "background";

type HeroState = {
  phase: HeroPhase;
  actions: {
    setPhase: (phase: HeroPhase) => void;
    togglePhase: () => void;
  };
};

/**
 * Синглтон — в отличие от store ленты, здесь нет серверных данных: фаза рождается
 * только из действий пользователя, SSR о ней ничего не знает.
 */
export const useHeroStore = create<HeroState>((set) => ({
  phase: "intro",
  actions: {
    setPhase: (phase) => set({ phase }),
    togglePhase: () =>
      set((state) => ({
        phase: state.phase === "intro" ? "background" : "intro",
      })),
  },
}));

export const useHeroPhase = (): HeroPhase =>
  useHeroStore((state) => state.phase);

export const useHeroActions = (): HeroState["actions"] =>
  useHeroStore((state) => state.actions);
