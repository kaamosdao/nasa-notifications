import { create } from "zustand";

/**
 * Ручки формы и анимации шара. Существуют только ради подбора вида: значения,
 * которые в итоге понравятся, переезжают в `HERO_CONTROLS_DEFAULTS` и дальше в
 * шейдер как константы — панель не часть продакшен-сцены.
 */
export type HeroControls = {
  /** Радиус центральной сферы в долях `uScale`. */
  core: number;
  /** Ширина «шейки» smooth-min: 0 — шары просто пересекаются, выше — слипаются. */
  blend: number;
  /** Сколько спутников на орбите. */
  orbitCount: number;
  /** Радиус орбиты первого спутника, дальше растёт. */
  orbitDistance: number;
  /** Размах спутников по вертикали. */
  orbitLift: number;
  /** Радиус первого спутника, дальше убывает. */
  orbitRadius: number;
  /** Общий множитель скорости обращения. */
  speed: number;
  /** Радиус шара, который тянется за курсором. */
  cursorRadius: number;
  /** Глубина ряби: насколько сильно волна наклоняет нормаль. */
  waveAmp: number;
  /** Частота ряби: выше — мелкая зыбь, ниже — крупная волна. */
  waveScale: number;
  /** Скорость течения ряби. */
  waveSpeed: number;
  /** Сколько неба видно сквозь толщу: 0 — чёрное зеркало, выше — вода. */
  refraction: number;
  /** Общая яркость звёздного поля: сдвигает порог, ниже которого звезду не видно. */
  starGain: number;
  /** Количество межзвёздной пыли: 0 — полоса без прожилок. */
  dust: number;
  /** Яркость туманностей: они же дают фону цвет. */
  nebula: number;
  /** Насколько туманности живут: дыхание яркости, оттенка и медленное течение. */
  nebulaLife: number;
  /** Глубина мерцания звёзд: у каждой свой период и фаза. */
  twinkle: number;
  /** Жёсткость пружины курсорного шара (считается на CPU). */
  spring: number;
  /** Скорость сглаживания параллакса неба, 1/с (считается на CPU). */
  parallaxRate: number;
};

/** Текущий вид сцены: панель стартует ровно с него, ничего не меняя. */

export const HERO_CONTROLS_DEFAULTS: HeroControls = {
  core: 1.07,
  blend: 0.57,
  orbitCount: 6,
  orbitDistance: 0.7,
  orbitLift: 0.46,
  orbitRadius: 0.48,
  speed: 0.15,
  cursorRadius: 0.3,
  spring: 4.5,
  parallaxRate: 0.3,
  waveAmp: 0.43,
  waveScale: 1,
  waveSpeed: 0.46,
  refraction: 0.55,
  starGain: 0.3,
  dust: 2.4,
  nebula: 0.2,
  nebulaLife: 2.5,
  twinkle: 0.55,
};

export type HeroControlField = {
  key: keyof HeroControls;
  label: string;
  group: "Shape" | "Water" | "Sky" | "Motion";
  min: number;
  max: number;
  step: number;
};

/**
 * Описание ручек данными, а не разметкой: панель — цикл по этому массиву, новая
 * ручка добавляется одной строкой здесь и одним uniform'ом в шейдере.
 */

export const HERO_CONTROL_FIELDS: readonly HeroControlField[] = [
  {
    key: "core",
    label: "Core",
    group: "Shape",
    min: 0.3,
    max: 1.6,
    step: 0.01,
  },
  {
    key: "blend",
    label: "Blend",
    group: "Shape",
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    key: "orbitCount",
    label: "Satellites",
    group: "Shape",
    min: 0,
    max: 6,
    step: 1,
  },
  {
    key: "orbitDistance",
    label: "Orbit radius",
    group: "Shape",
    min: 0.4,
    max: 2.2,
    step: 0.01,
  },
  {
    key: "orbitLift",
    label: "Vertical swing",
    group: "Shape",
    min: 0,
    max: 1.5,
    step: 0.01,
  },
  {
    key: "orbitRadius",
    label: "Satellite size",
    group: "Shape",
    min: 0.05,
    max: 0.8,
    step: 0.01,
  },
  {
    key: "cursorRadius",
    label: "Cursor blob",
    group: "Shape",
    min: 0,
    max: 0.8,
    step: 0.01,
  },
  {
    key: "waveAmp",
    label: "Ripple",
    group: "Water",
    min: 0,
    max: 1.2,
    step: 0.01,
  },
  {
    key: "waveScale",
    label: "Ripple scale",
    group: "Water",
    min: 0.5,
    max: 12,
    step: 0.1,
  },
  {
    key: "refraction",
    label: "Transmission",
    group: "Water",
    min: 0,
    max: 1.5,
    step: 0.01,
  },
  {
    key: "waveSpeed",
    label: "Flow",
    group: "Water",
    min: 0,
    max: 2,
    step: 0.01,
  },
  {
    key: "starGain",
    label: "Star brightness",
    group: "Sky",
    min: 0.01,
    max: 0.6,
    step: 0.01,
  },
  {
    key: "dust",
    label: "Dust",
    group: "Sky",
    min: 0,
    max: 4,
    step: 0.05,
  },
  {
    key: "nebula",
    label: "Nebulae",
    group: "Sky",
    min: 0,
    max: 2.5,
    step: 0.05,
  },
  {
    key: "nebulaLife",
    label: "Breathing",
    group: "Sky",
    min: 0,
    max: 2.5,
    step: 0.05,
  },
  {
    key: "twinkle",
    label: "Twinkle",
    group: "Sky",
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: "speed",
    label: "Orbit speed",
    group: "Motion",
    min: 0,
    max: 3,
    step: 0.01,
  },
  {
    key: "spring",
    label: "Cursor spring",
    group: "Motion",
    min: 2,
    max: 30,
    step: 0.5,
  },
  {
    key: "parallaxRate",
    label: "Sky inertia",
    group: "Motion",
    min: 0.3,
    max: 12,
    step: 0.1,
  },
];

type HeroControlsState = {
  controls: HeroControls;
  actions: {
    setControl: (key: keyof HeroControls, value: number) => void;
    setControls: (controls: HeroControls) => void;
    reset: () => void;
  };
};

export const useHeroControlsStore = create<HeroControlsState>((set) => ({
  controls: HERO_CONTROLS_DEFAULTS,
  actions: {
    setControl: (key, value) =>
      set((state) => ({ controls: { ...state.controls, [key]: value } })),
    setControls: (controls) => set({ controls }),
    reset: () => set({ controls: HERO_CONTROLS_DEFAULTS }),
  },
}));
