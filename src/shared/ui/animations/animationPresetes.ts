interface AnimationPhase {
  from: {
    [key: string]: string | number | undefined;
  };
  to: {
    [key: string]: string | number | undefined;
  };
}

interface AnimationData {
  in: AnimationPhase;
  out: AnimationPhase;
}

interface AnimatesMap {
  [key: string]: AnimationData;
}

export const ANIMATION_PRESETS: AnimatesMap = {
  progress: {
    in: {
      from: {
        "--progress": 0,
      },
      to: {
        "--progress": 1,
      },
    },
    out: {
      from: {
        "--progress": 1,
      },
      to: {
        "--progress": 0,
      },
    },
  },
  fade: {
    in: {
      from: {
        opacity: 0,
        pointerEvents: "none",
        transition: "none",
      },
      to: {
        opacity: 1,
        transition: "none",
        pointerEvents: "",
        clearProps: "opacity,transition",
      },
    },
    out: {
      from: {
        opacity: 1,
        pointerEvents: "",
      },
      to: {
        opacity: 0,
        pointerEvents: "none",
      },
    },
  },
  fadeSlide: {
    in: {
      from: {
        opacity: 0,
        yPercent: 103,
        pointerEvents: "none",
      },
      to: {
        opacity: 1,
        yPercent: 0,
        pointerEvents: "",
      },
    },
    out: {
      from: {
        opacity: 1,
        pointerEvents: "",
      },
      to: {
        opacity: 0,
        pointerEvents: "none",
      },
    },
  },
  blur: {
    in: {
      from: {
        filter: "blur(0.3em)",
        opacity: 0,
        pointerEvents: "none",
      },
      to: {
        filter: "blur(0px)",
        opacity: 1,
        pointerEvents: "",
      },
    },
    out: {
      from: {
        filter: "blur(0px)",
        opacity: 1,
        pointerEvents: "",
      },
      to: {
        filter: "blur(0.3em)",
        opacity: 0,
        pointerEvents: "none",
      },
    },
  },
  slide: {
    in: {
      from: {
        yPercent: 104,
        pointerEvents: "none",
      },
      to: {
        yPercent: 0,
        pointerEvents: "",
      },
    },
    out: {
      from: {
        yPercent: 0,
        pointerEvents: "",
      },
      to: {
        yPercent: -104,
        pointerEvents: "none",
      },
    },
  },
};

export type AnimationPresetType = keyof typeof ANIMATION_PRESETS;
