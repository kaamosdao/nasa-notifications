# Animations

Набор UI-компонентов анимации на **GSAP** (+ CSS transitions для presence). Импорт из барреля:

```ts
import {
  Animate,
  AnimateInView,
  AnimateNumberSwitcher,
  AnimatePresence,
  LineByLineAnimation,
  LineByLineAnimationInView,
  MaskImageAnimation,
  MaskImageAnimationInView,
  ResizeAnimate,
  SplitTextAnimate,
  SplitTextAnimateInView,
  SwitchCss,
  SwitchElement,
} from "@shared/ui/animations";
```

`AnimateHeightSwitchElement` пока не в барреле — импорт напрямую:

```ts
import { AnimateHeightSwitchElement } from "@shared/ui/animations/animate-height-switch-element";
```

---

## Общая модель

Большинство аниматоров завязаны на `isVisible`:

| `isVisible` | Фаза | Что происходит |
|-------------|------|----------------|
| `true` | `in` | вход (появление) |
| `false` | `out` | выход (скрытие) |

`*InView`-варианты оборачивают компонент в `Intersection` (`@shared/ui/Intersection`) и сами прокидывают `isVisible` при попадании во вьюпорт.

### Общие пропсы (`AnimationPropsType`)

| Prop | Тип | По умолчанию* | Описание |
|------|-----|---------------|----------|
| `isVisible` | `boolean` | `false` | Фаза анимации |
| `animateOnMount` | `boolean` | `false` | Сразу выставить стартовое состояние и проиграть вход |
| `animation` | `AnimationPresetType` | зависит от компонента | Ключ пресета из `ANIMATION_PRESETS` |
| `duration` | `number \| { in?, out? }` | `1` | Длительность (сек) |
| `delay` | `number \| { in?, out? }` | `0` | Задержка (сек) |
| `ease` | `string \| { in?, out? }` | зависит | GSAP ease |
| `stagger` | `number \| StaggerVars \| { in?, out? }` | зависит | Stagger между элементами |
| `onComplete` | `(isVisible: boolean) => void` | — | Колбэк после завершения твина |

\*Дефолты у конкретных компонентов могут отличаться.

`duration` / `delay` / `ease` / `stagger` можно задать одним значением для обеих фаз или раздельно:

```tsx
<Animate
  isVisible={open}
  duration={{ in: 0.8, out: 0.4 }}
  ease={{ in: "power3.out", out: "power2.in" }}
  animation="fade"
>
  <div>…</div>
</Animate>
```

### Пресеты (`ANIMATION_PRESETS`)

| Ключ | Эффект |
|------|--------|
| `fade` | opacity 0 ↔ 1 |
| `fadeSlide` | fade + сдвиг по `yPercent` |
| `slide` | сдвиг по `yPercent` (вход снизу / выход вверх) |
| `blur` | blur + opacity |
| `progress` | CSS-переменная `--progress` 0 ↔ 1 (маски, прогресс) |

Пресеты живут в `animationPresetes.ts`. Добавление нового — новый ключ в `ANIMATION_PRESETS` с фазами `in` / `out` (`from` / `to`).

### Slot / один ребёнок

`Animate` и `ResizeAnimate` используют `Slot`: **один** React-элемент-ребёнок, которому прокидывается `ref`.

---

## Карта компонентов

| Компонент | Назначение |
|-----------|------------|
| [`Animate`](#animate--animateinview) | Базовая GSAP-анимация одного элемента |
| [`AnimateInView`](#animate--animateinview) | То же + Intersection Observer |
| [`SplitTextAnimate`](#splittextanimate--splittextanimateinview) | Посимвольная / пословная анимация текста |
| [`LineByLineAnimation`](#linebylineanimation--linebylineanimationinview) | Анимация текста по строкам |
| [`MaskImageAnimation`](#maskimageanimation--maskimageanimationinview) | Reveal через CSS mask + `--progress` |
| [`ResizeAnimate`](#resizeanimate) | Плавное изменение width/height при ресайзе контента |
| [`AnimateNumberSwitcher`](#animatenumberswitcher) | Переключение цифр с enter/exit |
| [`AnimatePresence`](#animatepresence) | Enter/exit при смене дерева React |
| [`SwitchElement` / `SwitchCss`](#switchelement--switchcss) | Удобные обёртки над Presence |
| [`AnimateHeightSwitchElement`](#animateheightswitchelement) | Presence + анимация высоты контейнера |
| [`DelayDelete`](#delaydelete) | Отложенный unmount / прокидывание `isVisible` |

Подробности Presence: [`animate-presence/README.md`](./animate-presence/README.md).

---

## Animate / AnimateInView

Базовый аниматор: GSAP `fromTo` на корневом элементе по пресету.

```tsx
import { Animate, AnimateInView } from "@shared/ui/animations";

// Ручное управление
<Animate isVisible={open} animation="fade" duration={0.8}>
  <div>Контент</div>
</Animate>

// При скролле во вьюпорт
<AnimateInView animation="fadeSlide" duration={1.2} threshold={0.3}>
  <section>…</section>
</AnimateInView>
```

| Prop (InView) | Тип | По умолчанию | Описание |
|---------------|-----|--------------|----------|
| `threshold` | `number` | `0.3` | Доля видимости для Intersection |
| `triggerOnce` | `boolean` | `true` | Анимировать только при первом появлении |

---

## SplitTextAnimate / SplitTextAnimateInView

Дробит текст через `SplitText` и анимирует `.char` со stagger.

```tsx
<SplitTextAnimateInView type="word" animation="slide" stagger={0.02}>
  Заголовок с появлением по словам
</SplitTextAnimateInView>
```

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `type` | `"char" \| "word"` | `"word"` | Режим сплита |
| `as` | `ElementType` | `"div"` | Корневой тег |
| `disableClip` | `boolean` | — | Отключить clip у контейнера |
| `disableInnerSplitText` | `boolean` | `false` | Не оборачивать в `SplitText` (дети уже сплитнуты) |
| `animation` | preset | `"slide"` | Обычно `slide` / `fadeSlide` / `blur` |

---

## LineByLineAnimation / LineByLineAnimationInView

Считает визуальные строки (`useGetLines`) и анимирует слова/символы **построчно** со stagger между строками. Дополнительно крутит CSS-переменную `--animation-word`.

```tsx
<LineByLineAnimationInView animation="slide" stagger={0.12}>
  Длинный абзац, который появляется строка за строкой.
</LineByLineAnimationInView>
```

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `type` | `"char" \| "word"` | `"word"` | Режим сплита |
| `as` | `ElementType` | `"div"` | Корневой тег |
| `stagger` | number / … | `0.1` | Задержка между **строками** |

---

## MaskImageAnimation / MaskImageAnimationInView

Reveal через `mask-image` и пресет `progress` (`--progress` 0→1). Подходит для изображений и блоков с маской.

```tsx
<MaskImageAnimationInView direction="center" variant="radial">
  <img src="…" alt="" />
</MaskImageAnimationInView>
```

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `direction` | `"top" \| "bottom" \| "left" \| "right" \| "center" \| "left-top"` | `"center"` | Точка/направление маски |
| `variant` | `"radial" \| "linear"` | `"radial"` | Тип градиента маски |
| `as` | tag / component | `"div"` | Корневой элемент |
| … | `AnimateProps` | — | `isVisible`, `duration`, `ease`, … (`animation` всегда `progress`) |

---

## ResizeAnimate

Слушает `ResizeObserver` и tween’ит `width` / `height` между предыдущим и новым размером. После твина сбрасывает инлайн-размеры (`clearProps`), чтобы элемент снова жил на `auto`.

```tsx
<ResizeAnimate axis="height" duration={0.5}>
  <div>{content}</div>
</ResizeAnimate>
```

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `axis` | `"both" \| "width" \| "height"` | `"both"` | Какие оси анимировать |
| `duration` | `number` | `0.5` | Длительность твина |
| `ease` | `string` | `"power3.out"` | GSAP ease |
| `animateOnMount` | `boolean` | `false` | Анимировать с 0 при первом измерении |
| `onResizeComplete` | `() => void` | — | После завершения твина |

Ресайзы, вызванные самим твином, игнорируются (`isAnimating`).

---

## AnimateNumberSwitcher

Поцифровое переключение числа: каждая позиция — `SwitchElement` + `Animate`. Значение троттлится (`throttledFrames`).

```tsx
<AnimateNumberSwitcher
  number={price}
  throttledFrames={500}
  animateSettings={{ animation: "slide", duration: 0.6 }}
/>
```

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `number` | `number` | — | Отображаемое число |
| `throttledFrames` | `number` | `500` | Минимальный интервал обновления (мс) |
| `animateSettings` | `Omit<AnimateProps, "children">` | — | Пропсы для `Animate` каждой цифры |
| `classNameItem` | `string` | — | Класс на ячейку цифры |

---

## AnimatePresence

Enter/exit при mount/unmount детей. Режимы `sync` | `wait`, дети: `PresenceChildJS` (GSAP/`Animate`) или `PresenceChildCSS` (CSS-классы).

Полное API, хук `usePresence`, примеры CSS: **[animate-presence/README.md](./animate-presence/README.md)**.

```tsx
<AnimatePresence mode="wait">
  <PresenceChildJS key={tab}>
    <Animate animation="fade" duration={0.8}>
      <div>{panel}</div>
    </Animate>
  </PresenceChildJS>
</AnimatePresence>
```

> У каждого прямого ребёнка Presence должен быть уникальный `key`.

---

## SwitchElement / SwitchCss

Обёртки «смена ключа → exit старого + enter нового».

```tsx
// GSAP / Animate
<SwitchElement transitionKey={activeTab} mode="wait">
  <Animate animation="fade" duration={0.8}>
    <div>{content}</div>
  </Animate>
</SwitchElement>

// CSS transitions (classNames="fade", timeout=300)
<SwitchCss transitionKey={activeTab}>
  <div>{content}</div>
</SwitchCss>
```

| Prop | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `transitionKey` | `string \| number \| boolean \| unknown[]` | — | При смене — новая анимация |
| `isVisible` | `boolean` | `true` | `false` — убрать ребёнка с exit |
| `mode` | `"sync" \| "wait"` | `"wait"` | Режим Presence |
| `onEnter` / `onLeave` / `onLeaveComplete` | `(ref) => void` | — | Хуки жизненного цикла |
| `onTransition` | `(next, prev) => void` | — | При смене ключа (только `SwitchElement`) |

---

## AnimateHeightSwitchElement

Контейнер под Presence-переключение с **анимацией высоты**: перед сменой фиксирует текущую высоту, на leave позиционирует уходящий узел абсолютно, на enter tween’ит контейнер к `height: auto`.

```tsx
<AnimateHeightSwitchElement transitionKey={tab}>
  <SwitchElement transitionKey={tab} mode="wait">
    <Animate animation="fade">
      <div>{panels[tab]}</div>
    </Animate>
  </SwitchElement>
</AnimateHeightSwitchElement>
```

| Prop | Тип | Описание |
|------|-----|----------|
| `transitionKey` | `string \| number \| boolean \| unknown[]` | Ключ смены контента |
| `children` | `ReactElement` | Один ребёнок с поддержкой `onEnter` / `onLeave` (например `SwitchElement` / `PresenceChildJS`) |

---

## DelayDelete

Не удаляет из DOM сразу: при `isVisible === false` ждёт `timeout` (сек, через `gsap.delayedCall`) и вызывает `onComplete`. Либо render-prop, либо клонирует ребёнка с `ref` + `isVisible`.

```tsx
<DelayDelete isVisible={open} timeout={0.8} onComplete={safeToRemove}>
  {(props) => <Animate {...props} animation="fade"><div>…</div></Animate>}
</DelayDelete>
```

---

## Хуки и утилиты

| API | Где | Назначение |
|-----|-----|------------|
| `useAnimateSetup` | `hooks/use-animate-setup.ts` | Общий lifecycle: setup-стейт на mount → GSAP timeline при смене `isVisible` |
| `getAnimationProps` | `utils.ts` | Разворачивает `in`/`out` в плоские tween-vars |
| `createSetupTimeline` | `utils/create-setup-timeline.ts` | «Фейковый» timeline: на mount ставит конечные стили без GSAP |
| `usePresence` | `animate-presence` | `isPresent` + `safeToRemove` внутри Presence |
| `useGetLines` | `line-by-line-animation` | Карта визуальных строк для line-анимации |

Кастомный аниматор на базе хука:

```tsx
useAnimateSetup(
  (tl, animationProps, animationSettings) => {
    tl.fromTo(targets, animationSettings.from, {
      ...animationSettings.to,
      ...animationProps,
    });
  },
  { animation: "fade", duration, delay, ease, stagger },
  isVisible,
  animateOnMount,
  onComplete,
);
```

---

## Структура модуля

```
animations/
├── README.md                          ← эта документация
├── index.ts                           ← публичный баррель
├── types.ts                           ← AnimationPropsType, Intersection…
├── animationPresetes.ts               ← ANIMATION_PRESETS
├── utils.ts                           ← getAnimationProps
├── utils/create-setup-timeline.ts
├── hooks/use-animate-setup.ts
├── animate/                           ← Animate, AnimateInView
├── split-text-animate/
├── line-by-line-animation/
├── mask-image-animation/
├── resize-animate/
├── animate-number-switcher/
├── animate-height-switch-element/     ← не в барреле index.ts
└── animate-presence/                  ← Presence + README
```

---

## Зависимости

- **GSAP** — твины и timeline
- **`@shared/ui/slot`** — `Animate`, `ResizeAnimate`
- **`@shared/ui/split-text`** — text-аниматоры
- **`@shared/ui/Intersection`** — все `*InView` (прокидывает `isVisible`)
- **`useCountValueUpdate` / `useValueUpdate` / `useThrottledValue`** — смена ключей и throttling

---

## Когда что брать

| Задача | Компонент |
|--------|-----------|
| Fade/slide блока по флагу или во вьюпорте | `Animate` / `AnimateInView` |
| Появление заголовка по словам/буквам | `SplitTextAnimate(InView)` |
| Абзац по визуальным строкам | `LineByLineAnimation(InView)` |
| Reveal картинки маской | `MaskImageAnimation(InView)` |
| Плавный рост/сжатие контейнера при смене контента | `ResizeAnimate` или `AnimateHeightSwitchElement` |
| Табы / условный рендер с exit | `SwitchElement` / `AnimatePresence` |
| Счётчик / цена с анимацией цифр | `AnimateNumberSwitcher` |
| Свой GSAP-сценарий | `useAnimateSetup` + пресет или кастомный `fromTo` |
