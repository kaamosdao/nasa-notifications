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

/**
 * Ручки формы и анимации. Пока вид подбирается, они приходят из dev-панели;
 * когда значения устоятся, их место — константы прямо здесь.
 */
uniform float uCore;
uniform float uBlend;
uniform float uOrbitCount;
uniform float uOrbitDistance;
uniform float uOrbitLift;
uniform float uOrbitRadius;
uniform float uSpeed;
uniform float uCursorRadius;

/** Вода: рябь на поверхности и то, сколько неба видно сквозь шар. */
uniform float uWaveAmp;
uniform float uWaveScale;
uniform float uWaveSpeed;
uniform float uRefraction;

out vec4 fragColor;

#define FOV 0.8
#define MAX_STEPS 88
#define MAX_DIST 14.0
#define SURF_EPS 0.0015
/** Верхняя граница цикла: реальное число спутников задаёт uOrbitCount. */
#define MAX_ORBITS 6

/**
 * Нормаль плоскости Галактики. Наклон подобран так, чтобы полоса шла по кадру
 * диагональю, а не делила его пополам по горизонту.
 */
#define GALACTIC_NORMAL normalize(vec3(0.36, 0.86, -0.36))

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

/** Октавы параметром: небу нужен детальный шум, пыли хватает трёх слоёв. */
float fbm(vec3 p, int octaves) {
  float amplitude = 0.5;
  float sum = 0.0;

  for (int i = 0; i < octaves; i++) {
    sum += amplitude * noise3(p);
    p *= 2.02;
    amplitude *= 0.5;
  }

  return sum;
}

/**
 * Цвет абсолютно чёрного тела по температуре (аппроксимация Планка).
 * Спектральный класс — то, что отличает звёздное поле от россыпи белых точек:
 * холодные красные карлики массовы, горячие голубые единичны.
 */
vec3 blackbody(float kelvin) {
  float t = kelvin * 0.01;
  vec3 c;

  c.r = t <= 66.0 ? 1.0 : 1.292936 * pow(t - 60.0, -0.1332047);
  c.g = t <= 66.0
    ? 0.3900816 * log(t) - 0.6318414
    : 1.129891 * pow(t - 60.0, -0.0755148);
  c.b = t >= 66.0
    ? 1.0
    : (t <= 19.0 ? 0.0 : 0.5432068 * log(t - 10.0) - 1.196254);

  return clamp(c, 0.0, 1.0);
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
  float k = uBlend * uScale;
  float d = sdSphere(p, vec3(0.0), uCore * uScale);

  for (int i = 0; i < MAX_ORBITS; i++) {
    float fi = float(i);

    if (fi >= uOrbitCount) {
      break;
    }

    // Спутники расходятся по радиусу и скорости: с одинаковыми они выстраиваются
    // в кольцо и вращение читается как единая жёсткая деталь.
    float a = uTime * (0.22 + 0.06 * fi) * uSpeed + fi * 1.87;
    float dist = uOrbitDistance * (1.0 + 0.095 * fi);
    vec3 c = vec3(
      cos(a) * dist,
      sin(a * 0.7 + fi * 1.3) * uOrbitLift,
      sin(a) * dist
    ) * uScale;

    d = smin(d, sdSphere(p, c, uOrbitRadius * (1.0 - 0.1 * fi) * uScale), k);
  }

  // Без указателя шар чуть поджимается: на орбите он далеко и не должен спорить
  // с главным по массе.
  float cursorRadius = uCursorRadius * mix(0.667, 1.0, uCursorActive);

  d = smin(d, sdSphere(p, uCursor * uScale, cursorRadius * uScale), k * 0.9);

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

/**
 * Рябь. Геометрию не трогаем: волна на SDF стоила бы четырёх лишних fbm в каждом
 * шаге марша, тогда как на нормали её видно ровно так же — вся вода в кадре и так
 * читается только по бликам и по тому, как гуляет отражение.
 *
 * Из градиента убирается составляющая вдоль нормали: она бы просто гасила саму
 * нормаль, а наклонять её надо в касательной плоскости.
 */
vec3 waveNormal(vec3 p, vec3 n) {
  if (uWaveAmp <= 0.0) {
    return n;
  }

  // Шум течёт вдоль своей четвёртой оси, а не сдвигается целиком: сдвиг читался
  // бы как движение шара, а не как жизнь на его поверхности.
  vec3 q = p * uWaveScale + vec3(0.0, uTime * uWaveSpeed, uTime * uWaveSpeed * 0.6);

  float e = 0.35;
  float h = fbm(q, 2);
  vec3 grad = vec3(
    fbm(q + vec3(e, 0.0, 0.0), 2) - h,
    fbm(q + vec3(0.0, e, 0.0), 2) - h,
    fbm(q + vec3(0.0, 0.0, e), 2) - h
  ) / e;

  grad -= n * dot(grad, n);

  return normalize(n + grad * uWaveAmp);
}

/**
 * Один слой звёзд. Сетка трёхмерная и адресуется направлением луча, поэтому небо
 * бесконечно и не тайлится по экрану.
 *
 * Звезда здесь — точка на небесной сфере, а не диск в ячейке: расстояние до неё
 * меряется в радианах между направлениями, поэтому угловой размер задаётся явно
 * и не зависит ни от масштаба слоя, ни от разрешения канваса.
 *
 * right/up — экранный базис: по нему ориентированы дифракционные лучи, и
 * ориентация у всех звёзд общая, как у реального объектива.
 *
 * spread — угловой радиус ядра. Меньше пикселя звезду делать нельзя: она
 * начинает мерцать при малейшем движении камеры.
 *
 * clump — множитель плотности. Звёзды не рассыпаны равномерно, скучиваться их
 * заставляет диск Галактики.
 */
vec3 starLayer(
  vec3 d,
  vec3 right,
  vec3 up,
  float scale,
  float density,
  float spread,
  float clump
) {
  vec3 p = d * scale;
  vec3 cell = floor(p);

  if (hash31(cell) > density * clump) {
    return vec3(0.0);
  }

  // Разброс держим в пределах половины ячейки: соседние ячейки мы не перебираем,
  // и гало звезды у самой границы обрезалось бы швом.
  vec3 jitter = vec3(
    hash31(cell + 1.7),
    hash31(cell + 3.3),
    hash31(cell + 5.9)
  ) - 0.5;
  vec3 starDir = normalize(cell + 0.5 + jitter * 0.5);

  // Направления почти совпадают, поэтому хорда — уже сам угол, без acos.
  vec3 delta = starDir - d;
  vec2 t = vec2(dot(delta, right), dot(delta, up));
  float r = length(t);

  // Светимости различаются на порядки: степень от равномерной величины даёт
  // много слабых звёзд и единицы очень ярких — так же выглядит реальное поле.
  float mag = pow(hash31(cell + 11.13), 5.0);
  float lum = mix(0.015, 1.0, mag);

  // Ядро — почти точка: даже самая яркая звезда занимает считанные пиксели.
  // Ниже пикселя опускаться нельзя, там начинается мерцание на движении камеры.
  float want = spread * (0.4 + 0.55 * mag);

  // Сверху размер ограничен ячейкой: звезда шире неё заливает ячейку целиком, и
  // вместо звёзд по небу идут кубы — ровно это видно в отражении, где spread
  // намеренно большой. Ячейка адресуется направлением, её угловой размер — 1/scale.
  float core = min(want, 0.2 / scale);

  // Размытие не добавляет света: звезда отдаёт яркость ровно в той мере, в какой
  // её не дали размазать. Поэтому в отражении остаются только самые яркие — так
  // размытое отражение звёздного поля и выглядит.
  lum *= (core * core) / (want * want);

  float ar = r / core;

  float disc = exp(-ar * ar * 1.6);
  float halo = 0.16 * exp(-ar * 0.55);

  // Крест виден только у ярких: у слабых он утонул бы в шуме и дал бы «сетку».
  vec2 a = abs(t) / core;
  float spikes = exp(-a.x * 0.5 - a.y * a.y * 0.7)
    + exp(-a.y * 0.5 - a.x * a.x * 0.7);
  spikes *= 0.09 * smoothstep(0.4, 1.0, mag);

  // Соседние ячейки мы не перебираем, поэтому всё, что доживает до границы,
  // гасится окном: иначе по небу идёт сетка швов. Ядро тоже — оно у самой яркой
  // звезды заметно шире точки.
  vec3 fc = abs(fract(p) - 0.5);
  float window = smoothstep(0.5, 0.3, max(fc.x, max(fc.y, fc.z)));

  vec3 tint = blackbody(mix(2700.0, 11500.0, pow(hash31(cell + 17.21), 1.7)));

  return tint * lum * (disc + halo + spikes) * window;
}

/** Синус галактической широты: 0 — центр полосы, ±1 — полюса. */
float galacticLatitude(vec3 d) {
  return dot(d, GALACTIC_NORMAL);
}

/**
 * Диск Галактики. Шум сжат поперёк плоскости, иначе получаются облака, а не
 * полоса; тёмные прожилки пыли вычитаются — именно они делают Млечный Путь
 * узнаваемым, без них остаётся просто светлое пятно.
 */
vec3 milkyWay(vec3 d, float band) {
  vec3 n = GALACTIC_NORMAL;
  vec3 tangent = normalize(cross(n, vec3(0.0, 0.0, 1.0)));
  vec3 bitangent = cross(n, tangent);
  // Частота считается по всей сфере, а кадр охватывает лишь её часть: на низких
  // октавах в него попадает пара размытых пятен вместо структуры диска.
  vec3 q = vec3(dot(d, tangent), dot(d, n) * 3.2, dot(d, bitangent)) * 11.0;

  float glow = fbm(q + 3.1, 4);
  float dust = smoothstep(0.32, 0.68, fbm(q * 1.7 + 17.0, 3));
  float body = band * (0.25 + 1.0 * glow) * (1.0 - 0.8 * dust);

  return mix(vec3(0.006, 0.0062, 0.011), vec3(0.016, 0.014, 0.024), glow) * body;
}

/**
 * Небо целиком: фон и содержимое отражения — одна и та же функция.
 *
 * spread — угловой радиус самой мелкой детали. Для фона это пиксель, для
 * отражения — заметно больше: кривизна шара сжимает в один пиксель целый кусок
 * неба, и точечные звёзды там кипели бы на каждом кадре.
 */
vec3 env(vec3 rd, float spread) {
  vec3 d = normalize(rd + vec3(uParallax * 0.06, 0.0));

  // Опорную ось меняем у полюса: cross с почти сонаправленным вектором вырожден.
  vec3 ref = abs(d.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec3 right = normalize(cross(d, ref));
  vec3 up = cross(right, d);

  float lat = galacticLatitude(d);
  float band = exp(-lat * lat * 60.0);

  vec3 col = mix(vec3(0.0012, 0.0016, 0.004), vec3(0.002, 0.0025, 0.006), band);
  col += milkyWay(d, band);

  // К полосе звёзды сгущаются, вдали от неё поле заметно реже.
  float clump = 0.5 + 1.9 * band;

  col += starLayer(d, right, up, 26.0, 0.14, spread, clump);
  col += starLayer(d, right, up, 57.0, 0.11, spread, clump) * 0.8;
  col += starLayer(d, right, up, 119.0, 0.08, spread, clump) * 0.55;

  return col;
}

/** Мягкое сжатие светов: ядро яркой звезды уходит в белый, гало сохраняет цвет. */
vec3 tonemap(vec3 x) {
  return x / (1.0 + x);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;

  vec3 ro = vec3(uOffset, uCamZ);
  vec3 rd = normalize(vec3(uv * FOV, -1.0));

  // Угловой размер пикселя. Считается от буфера, а не от CSS-размера, поэтому
  // при деградации качества звёзды укрупняются вместе с ним и не начинают рябить.
  float pixelAngle = 2.0 * FOV / uResolution.y;

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
    vec3 n = waveNormal(p, calcNormal(p));
    vec3 r = reflect(rd, n);

    // Френель по Шлику, F0 = 0.02 — это ровно вода: в центре сквозь поверхность
    // видно объём, к краям она превращается в зеркало.
    float facing = clamp(dot(-rd, n), 0.0, 1.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);

    vec3 key = normalize(vec3(0.6, 0.8, 0.4));
    float spec = pow(max(dot(r, key), 0.0), 90.0);

    // Небо сквозь толщу: показатель преломления воды и поглощение красного —
    // отсюда сине-зелёный цвет, а не тонировка на глаз.
    vec3 through = env(refract(rd, n, 1.0 / 1.333), pixelAngle * 9.0);
    through *= vec3(0.25, 0.62, 0.75) * uRefraction;

    col = vec3(0.002, 0.003, 0.005);
    col += through * (1.0 - fresnel) * uEnvIntensity;
    col += env(r, pixelAngle * 7.0) * fresnel * uEnvIntensity;
    col += vec3(0.9, 0.95, 1.0) * spec * 0.6 * uEnvIntensity;
    col += vec3(0.16, 0.22, 0.42) * pow(1.0 - facing, 3.0) * 0.35 * uEnvIntensity;
  } else {
    col = env(rd, pixelAngle);
  }

  col *= 1.0 - 0.09 * dot(uv, uv);
  fragColor = vec4(pow(tonemap(max(col, 0.0)), vec3(0.4545)), 1.0);
}
`;
