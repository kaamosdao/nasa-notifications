import type { HeroPhase } from "../model/hero-store";
import { FRAGMENT_SHADER } from "./shaders/fragment";
import { VERTEX_SHADER } from "./shaders/vertex";

const UNIFORM_NAMES = [
  "uResolution",
  "uTime",
  "uCursor",
  "uCursorActive",
  "uCamZ",
  "uScale",
  "uEnvIntensity",
  "uParallax",
  "uOffset",
] as const;

type UniformName = (typeof UNIFORM_NAMES)[number];

/** Тот же tan(fov/2), что в шейдере: нужен, чтобы unproject курсора совпал с картинкой. */
const FOV = 0.8;
/** Плоскость, на которую проецируется указатель, — чуть перед главным шаром. */
const CURSOR_PLANE_Z = 0.4;

const DPR_CAP = 1.75;
/** При каждом шаге деградации качества режем разрешение — шаги raymarching фиксированы. */
const QUALITY_BY_PERFORMANCE_INDEX = [1, 0.85, 0.7, 0.6, 0.5, 0.45];

const PHASE_TARGETS: Record<
  HeroPhase,
  {
    camZ: number;
    scale: number;
    envIntensity: number;
    resolution: number;
    /** Сдвиг камеры в долях полуширины кадра: шар уходит из-под ленты влево. */
    offsetX: number;
  }
> = {
  intro: { camZ: 3.2, scale: 1, envIntensity: 1, resolution: 1, offsetX: 0 },
  background: {
    camZ: 4.6,
    scale: 0.72,
    envIntensity: 0.45,
    resolution: 0.6,
    offsetX: 0.62,
  },
};

/** Скорость подтягивания uniform'ов к целям фазы (доля остатка в секунду). */
const PHASE_RATE = 3;
/** Критически задемпфированная пружина курсорного шара. */
const SPRING_OMEGA = 11;
const MAX_DELTA = 1 / 30;

export type HeroRendererOptions = {
  canvas: HTMLCanvasElement;
  /** prefers-reduced-motion: один статичный кадр, указатель не отслеживается. */
  reducedMotion?: boolean;
};

export const isWebgl2Supported = (): boolean => {
  if (typeof document === "undefined") return false;

  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
};

const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("hero: не удалось создать шейдер");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`hero: ошибка компиляции шейдера — ${log}`);
  }

  return shader;
};

/**
 * Владеет WebGL-контекстом, слушателями указателя и rAF-циклом. React-слой только
 * создаёт/уничтожает рендерер и переключает фазу — вся мутабельная механика здесь.
 */
export class HeroRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly uniforms: Record<UniformName, WebGLUniformLocation | null>;
  private readonly resizeObserver: ResizeObserver;
  private readonly reducedMotion: boolean;

  private rafId = 0;
  private lastTime = 0;
  private time = 0;
  private isDestroyed = false;

  private phase: HeroPhase = "intro";
  private quality = 1;

  private camZ = PHASE_TARGETS.intro.camZ;
  private scale = PHASE_TARGETS.intro.scale;
  private envIntensity = PHASE_TARGETS.intro.envIntensity;
  private resolutionScale = PHASE_TARGETS.intro.resolution;
  private offsetX = PHASE_TARGETS.intro.offsetX;

  /** CSS-размеры канваса: держим от ResizeObserver, чтобы не читать layout каждый кадр. */
  private cssWidth = 0;
  private cssHeight = 0;

  /** NDC-указатель для параллакса неба. */
  private pointer: [number, number] = [0, 0];
  private cursorActive = 0;
  private cursorActiveTarget = 0;
  private cursorPos: [number, number, number] = [1.6, 0, CURSOR_PLANE_Z];
  private cursorVel: [number, number, number] = [0, 0, 0];

  constructor({ canvas, reducedMotion = false }: HeroRendererOptions) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });

    if (!gl) throw new Error("hero: WebGL2 недоступен");

    this.canvas = canvas;
    this.gl = gl;
    this.reducedMotion = reducedMotion;

    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();

    if (!program) throw new Error("hero: не удалось создать программу");

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    // Шейдеры больше не нужны: программа слинкована, объекты удалятся вместе с ней.
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`hero: ошибка линковки — ${log}`);
    }

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("hero: не удалось создать VAO");

    this.program = program;
    this.vao = vao;
    this.uniforms = UNIFORM_NAMES.reduce(
      (acc, name) => {
        acc[name] = gl.getUniformLocation(program, name);
        return acc;
      },
      {} as Record<UniformName, WebGLUniformLocation | null>,
    );

    // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram — метод WebGL, а не React-хук
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(canvas);

    const rect = canvas.getBoundingClientRect();
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.resize();

    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    if (reducedMotion) {
      this.renderFrame();
      return;
    }

    window.addEventListener("pointermove", this.handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerdown", this.handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerleave", this.handlePointerLeave);
    this.start();
  }

  setPhase(phase: HeroPhase): void {
    this.phase = phase;

    if (this.reducedMotion) {
      this.applyPhaseTargets(1);
      this.resize();
      this.renderFrame();
    }
  }

  /** `performanceIndex` из `widgets/performance-detect`: чем выше, тем ниже разрешение. */
  setPerformanceIndex(index: number): void {
    const quality =
      QUALITY_BY_PERFORMANCE_INDEX[
        Math.min(index, QUALITY_BY_PERFORMANCE_INDEX.length - 1)
      ];

    if (quality === this.quality) return;

    this.quality = quality;
    this.resize();
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerdown", this.handlePointerMove);
    window.removeEventListener("pointerleave", this.handlePointerLeave);

    this.gl.bindVertexArray(null);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
    // Без явной потери контекста браузер держит его до GC — на переходах утекают контексты.
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  private start(): void {
    if (this.rafId || this.isDestroyed) return;

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (!this.rafId) return;

    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private handleVisibilityChange = (): void => {
    if (this.reducedMotion) return;

    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  };

  private handlePointerMove = (event: PointerEvent): void => {
    const { innerWidth, innerHeight } = window;

    this.pointer = [
      (event.clientX / innerWidth) * 2 - 1,
      1 - (event.clientY / innerHeight) * 2,
    ];
    this.cursorActiveTarget = 1;
  };

  private handlePointerLeave = (): void => {
    this.cursorActiveTarget = 0;
  };

  private handleResize = (entries: ResizeObserverEntry[]): void => {
    const rect = entries[0]?.contentRect;
    if (!rect) return;

    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.resize();

    // Без rAF-цикла новый буфер остался бы пустым: перерисовываем единственный кадр.
    if (this.reducedMotion) this.renderFrame();
  };

  private resize = (): void => {
    const { canvas } = this;
    const pixelRatio =
      Math.min(window.devicePixelRatio || 1, DPR_CAP) *
      this.quality *
      this.resolutionScale;

    const width = Math.max(1, Math.round(this.cssWidth * pixelRatio));
    const height = Math.max(1, Math.round(this.cssHeight * pixelRatio));

    if (canvas.width === width && canvas.height === height) return;

    canvas.width = width;
    canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  };

  private applyPhaseTargets(factor: number): void {
    const target = PHASE_TARGETS[this.phase];

    this.camZ += (target.camZ - this.camZ) * factor;
    this.scale += (target.scale - this.scale) * factor;
    this.envIntensity += (target.envIntensity - this.envIntensity) * factor;
    this.resolutionScale += (target.resolution - this.resolutionScale) * factor;
    this.offsetX += (target.offsetX - this.offsetX) * factor;
  }

  /**
   * Сдвиг задан в долях полуширины кадра, а не в мировых единицах: иначе на узком экране
   * шар уезжал бы за границу вместе с ростом мировой ширины.
   */
  private getWorldOffsetX(): number {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);

    return this.offsetX * aspect * FOV * this.camZ;
  }

  /** Куда тянется курсорный шар: к указателю, а без него — обратно на орбиту. */
  private getCursorTarget(): [number, number, number] {
    if (!this.cursorActiveTarget) {
      const angle = this.time * 0.35;
      return [Math.cos(angle) * 1.55, Math.sin(angle * 0.8) * 0.45, 0.2];
    }

    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const reach = FOV * this.camZ;

    return [
      this.getWorldOffsetX() + this.pointer[0] * aspect * reach,
      this.pointer[1] * reach,
      CURSOR_PLANE_Z,
    ];
  }

  private updateCursor(delta: number): void {
    const target = this.getCursorTarget();
    const omega = SPRING_OMEGA;

    for (let axis = 0; axis < 3; axis++) {
      const offset = this.cursorPos[axis] - target[axis];
      const acceleration =
        -2 * omega * this.cursorVel[axis] - omega * omega * offset;

      this.cursorVel[axis] += acceleration * delta;
      this.cursorPos[axis] += this.cursorVel[axis] * delta;
    }
  }

  private tick = (now: number): void => {
    // Кадр после возврата из фона может быть длиной в минуты — иначе пружина взорвётся.
    const delta = Math.min((now - this.lastTime) / 1000, MAX_DELTA);
    this.lastTime = now;
    this.time += delta;

    this.cursorActive +=
      (this.cursorActiveTarget - this.cursorActive) *
      Math.min(1, PHASE_RATE * delta);

    this.applyPhaseTargets(Math.min(1, PHASE_RATE * delta));
    this.updateCursor(delta);
    this.resize();
    this.renderFrame();

    this.rafId = requestAnimationFrame(this.tick);
  };

  private renderFrame(): void {
    const { canvas } = this;
    const gl = this.gl;

    gl.uniform2f(this.uniforms.uResolution, canvas.width, canvas.height);
    gl.uniform1f(this.uniforms.uTime, this.time);
    gl.uniform3f(
      this.uniforms.uCursor,
      this.cursorPos[0],
      this.cursorPos[1],
      this.cursorPos[2],
    );
    gl.uniform1f(this.uniforms.uCursorActive, this.cursorActive);
    gl.uniform1f(this.uniforms.uCamZ, this.camZ);
    gl.uniform1f(this.uniforms.uScale, this.scale);
    gl.uniform1f(this.uniforms.uEnvIntensity, this.envIntensity);
    gl.uniform2f(this.uniforms.uParallax, this.pointer[0], this.pointer[1]);
    gl.uniform2f(this.uniforms.uOffset, this.getWorldOffsetX(), 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
