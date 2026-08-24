import { create } from "zustand";

const MAX_PERFORMANCE_INDEX = 5;

type PerformanceState = {
  performanceIndex: number;
  actions: {
    incrementPerformanceIndex: () => void;
  };
};

export const usePerformanceStore = create<PerformanceState>((set) => ({
  performanceIndex: 0,
  actions: {
    incrementPerformanceIndex: () =>
      set((state) => ({
        performanceIndex: Math.min(
          state.performanceIndex + 1,
          MAX_PERFORMANCE_INDEX,
        ),
      })),
  },
}));

export const usePerformanceActions = (): PerformanceState["actions"] =>
  usePerformanceStore((state) => state.actions);
