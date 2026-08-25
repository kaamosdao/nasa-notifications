/**
 * Raymarching чёрного зеркального metaball на фоне звёздного неба.
 *
 * Одна процедурная функция `env()` даёт и фон, и то, что отражается в шаре, —
 * отражение согласовано с небом по построению, а не подгонкой цветов.
 */
export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
/** Позиция «курсорного» шара в мире (пружина считается на CPU). */
uniform vec3 uCursor;
/** 0 — указателя нет, шар вернулся на орбиту; 1 — тянется за курсором. */
uniform float uCursorActive;
uniform float uCamZ;
uniform float uScale;
uniform float uEnvIntensity;
uniform vec2 uParallax;
/** Сдвиг камеры в мире: в фоновой фазе уводит шар из-под ленты. */
uniform vec2 uOffset;

out vec4 fragColor;

#define FOV 0.8
#define MAX_STEPS 88
#define MAX_DIST 14.0
#define SURF_EPS 0.0015
#define SMIN_K 0.35
#define ORBIT_COUNT 4

float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(
      mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
      mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
      mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}

float fbm(vec3 p) {
  float amplitude = 0.5;
  float sum = 0.0;

  for (int i = 0; i < 4; i++) {
    sum += amplitude * noise3(p);
    p *= 2.02;
    amplitude *= 0.5;
  }

  return sum;
}

/** Полиномиальный smooth-min: «шейка» и отрыв шаров получаются из самой геометрии. */
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdSphere(vec3 p, vec3 c, float r) {
  return length(p - c) - r;
}

float map(vec3 p) {
  float k = SMIN_K * uScale;
  float d = sdSphere(p, vec3(0.0), uScale);

  for (int i = 0; i < ORBIT_COUNT; i++) {
    float fi = float(i);
    float a = uTime * (0.22 + 0.06 * fi) + fi * 1.87;
    vec3 c = vec3(
      cos(a) * (1.05 + 0.1 * fi),
      sin(a * 0.7 + fi * 1.3) * 0.5,
      sin(a) * (1.05 + 0.1 * fi)
    ) * uScale;

    d = smin(d, sdSphere(p, c, (0.34 - 0.035 * fi) * uScale), k);
  }

  d = smin(
    d,
    sdSphere(p, uCursor * uScale, mix(0.2, 0.3, uCursorActive) * uScale),
    k * 0.9
  );

  return d;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.0015;

  return normalize(
    e.xyy * map(p + e.xyy) +
    e.yyx * map(p + e.yyx) +
    e.yxy * map(p + e.yxy) +
    e.xxx * map(p + e.xxx)
  );
}

/** Слой звёзд: хеш-сетка по направлению луча, поэтому небо бесконечно и не тайлится по экрану. */
float starLayer(vec3 rd, float scale, float density) {
  vec3 p = rd * scale;
  vec3 cell = floor(p);
  vec3 f = fract(p) - 0.5;

  float mask = step(hash31(cell), density);
  vec3 offset = vec3(
    hash31(cell + 1.0),
    hash31(cell + 2.0),
    hash31(cell + 3.0)
  ) - 0.5;

  float star = smoothstep(0.1, 0.0, length(f - offset * 0.7));

  return star * mask * (0.4 + 0.6 * hash31(cell + 7.0));
}

vec3 env(vec3 rd) {
  vec3 d = normalize(rd + vec3(uParallax * 0.06, 0.0));

  float nebula = pow(fbm(d * 2.2 + vec3(0.0, 0.0, uTime * 0.008)), 2.2);
  vec3 col = mix(vec3(0.0015, 0.002, 0.005), vec3(0.05, 0.025, 0.12), nebula);
  col += vec3(0.01, 0.025, 0.05) * pow(fbm(d * 1.1 + 11.0), 3.0);

  float stars =
    starLayer(d, 28.0, 0.045) +
    starLayer(d, 60.0, 0.03) * 0.6 +
    starLayer(d, 120.0, 0.02) * 0.35;

  return col + vec3(0.85, 0.9, 1.0) * stars;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;

  vec3 ro = vec3(uOffset, uCamZ);
  vec3 rd = normalize(vec3(uv * FOV, -1.0));

  float t = 0.0;
  bool hit = false;

  for (int i = 0; i < MAX_STEPS; i++) {
    float d = map(ro + rd * t);

    if (d < SURF_EPS * t) {
      hit = true;
      break;
    }

    t += d * 0.9;

    if (t > MAX_DIST) {
      break;
    }
  }

  vec3 col;

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 r = reflect(rd, n);

    // Френель по Шлику, F0 = 0.02: центр почти чёрный, края вспыхивают отражением.
    float facing = clamp(dot(-rd, n), 0.0, 1.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);

    vec3 key = normalize(vec3(0.6, 0.8, 0.4));
    float spec = pow(max(dot(r, key), 0.0), 90.0);

    col = vec3(0.002, 0.002, 0.003);
    col += env(r) * fresnel * uEnvIntensity;
    col += vec3(0.9, 0.95, 1.0) * spec * 0.6 * uEnvIntensity;
    col += vec3(0.16, 0.22, 0.42) * pow(1.0 - facing, 3.0) * 0.35 * uEnvIntensity;
  } else {
    col = env(rd);
  }

  col *= 1.0 - 0.09 * dot(uv, uv);
  fragColor = vec4(pow(max(col, 0.0), vec3(0.4545)), 1.0);
}
`;
