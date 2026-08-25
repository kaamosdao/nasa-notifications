# План: NASA / GCN Notifications

Рабочий план проекта. Источник правды по архитектурным решениям — этот файл;
детали реализации по мере готовности переезжают в профильные документы и скиллы.

Статус: **этапы 0–3 выполнены.** Этап 0 — CMS-слой, imgproxy и Meilisearch удалены из кода,
compose, CI и ansible. Этап 1 — `services/ingestor` собран: парсеры, дедуп, catch-up, миграции,
Dockerfile, сервис в compose, моковый продюсер (`pnpm --filter ingestor seed --loop`).
⚠️ Живой прогон против Kafka не выполнен: пара `GCN_CLIENT_ID`/`GCN_CLIENT_SECRET` из переписки
отвергается брокером (`invalid_client`) — нужны перевыпущенные креды с gcn.nasa.gov.
Этап 3 — лента собрана: `entities/notice`, `features/notice-feed`, `widgets/notice-feed`,
SSR первых 20, SSE-клиент, анимации вставки, история вверх. Следующий — этап 4 (hero).

## 1. Что делаем

Сайт, который в реальном времени показывает поток научных оповещений
[GCN (General Coordinates Network, NASA)](https://gcn.nasa.gov/): гравитационные волны,
гамма-всплески, быстрые радиовсплески, нейтринные события, циркуляры.

Две сцены на одной странице:

1. **Hero** на всю высоту экрана — WebGL-канвас: чёрный зеркальный metaball на фоне
   звёздного неба, реагирует на курсор/тачпад (маленький шар отрывается от главного и
   следует за указателем).
2. По клику hero уезжает на задний план, поверх него появляется **лента оповещений** —
   поведение как в мессенджере: новые события приходят снизу, история подгружается сверху.

## 2. Принятые решения

| Вопрос | Решение | Почему |
|---|---|---|
| Поведение ленты | Как в мессенджере: новые снизу, история вверх | Соответствует природе потока — это хроника, а не новостная лента |
| Kafka-консьюмер | Отдельный Node-сервис `ingestor` | `gcn-kafka` — Node-only; один консьюмер на приложение независимо от числа инстансов фронта и вкладок |
| Хранилище | Postgres (уже есть в compose) | История переживает рестарт, курсорная пагинация, дедупликация индексом |
| Транспорт в браузер | SSE (`text/event-stream`) | Поток односторонний; автопереподключение из коробки; проще за nginx, чем WebSocket |
| Hero | Чистый WebGL2, фрагментный шейдер | Ноль новых зависимостей, полный контроль над перформансом, честное зеркальное отражение |
| Boilerplate | Удаляем Strapi, imgproxy, Meilisearch; остальное оставляем | Контента как такового нет — данные приходят из Kafka |

## 3. Архитектура

```
┌──────────────┐   Kafka/SASL     ┌─────────────┐
│  GCN (NASA)  │ ───────────────► │  ingestor   │  парсинг + нормализация
└──────────────┘                  │   (Node)    │  дедуп по (topic, partition, offset)
                                  └──────┬──────┘
                                         │ INSERT + pg_notify('gcn_notice', id)
                                         ▼
                                  ┌─────────────┐
                                  │  postgres   │
                                  └──────┬──────┘
                        SELECT / LISTEN  │
                                         ▼
                                  ┌─────────────┐    SSE     ┌─────────┐
                                  │  frontend   │ ─────────► │ browser │
                                  │   (Next)    │    JSON    │         │
                                  └─────────────┘            └─────────┘
```

Три сервиса в `docker-compose` вместо пяти: `ingestor`, `frontend`, `postgres`.

### 3.1 ingestor

Отдельный пакет в pnpm-workspace (`services/ingestor`), собственный Dockerfile.

- Один `gcn-kafka` consumer со **стабильным `groupId`** — после рестарта продолжает с коммита.
- **Catch-up при старте:** GCN хранит сообщения ~30 дней. На старте `seek` по timestamp на
  `now - 7d`, прогон до конца партиций, затем переход в live-режим. Без этого лента пустая,
  пока что-нибудь не прилетит, а GCN может молчать часами.
- **Дедупликация:** Kafka даёт at-least-once, при рестарте и ребалансировке дубли неизбежны →
  `unique (topic, kafka_partition, kafka_offset)`, вставка через `ON CONFLICT DO NOTHING`.
- `TOPIC_AUTHORIZATION_FAILED` — логируем и продолжаем: часть топиков может быть недоступна аккаунту.
- `gcn.heartbeat` **не пишем в БД** — тикает раз в ~30 с, служит liveness-сигналом:
  обновляем `service_state.last_heartbeat_at`, фронт показывает индикатор `LIVE`.
- Graceful shutdown: `consumer.disconnect()` по `SIGTERM`, иначе ребалансировка висит до таймаута.

### 3.2 Парсеры

Форматы топиков разнородны: у новых схем — JSON по
[gcn-schema](https://gcn.nasa.gov/docs/schema), у части — текст (циркуляры).

`parsers/` — мапа `topic → parser(buffer): NormalizedNotice`, с **обязательным fallback**:
`JSON.parse`, при неудаче — весь текст в `summary`, `kind: "unknown"`. Незнакомый формат не
должен ронять ни воркер, ни ленту.

Нормализованная форма (её же отдаём на фронт):

```ts
type NormalizedNotice = {
  id: string;
  topic: string;
  kind: "gw" | "grb" | "frb" | "neutrino" | "circular" | "unknown";
  title: string;
  summary: string | null;
  eventAt: string | null;      // ISO, время события по данным алерта
  receivedAt: string;          // ISO, когда получили
  coords: { ra: number; dec: number; errorRadius: number | null } | null;
  externalId: string | null;   // superevent_id / GRB name / ...
  payload: unknown;            // сырой JSON — для раскрытия карточки
};
```

Приоритетные форматы для проработанных карточек:

- `igwn.gwalert` — гравитационные волны: `superevent_id`, `significance`, `far`,
  классификация (BBH / BNS / NSBH / Terrestrial). Самые содержательные карточки.
- `gcn.circulars` — текстовые циркуляры: длинное тело, нужен collapse.
- `gcn.notices.*` — короткие машинные нотисы с координатами.

### 3.3 Схема БД

```sql
create table notices (
  id              bigserial primary key,
  topic           text not null,
  kafka_partition int  not null,
  kafka_offset    bigint not null,
  external_id     text,
  kind            text not null default 'unknown',
  title           text not null,
  summary         text,
  ra              double precision,
  dec             double precision,
  error_radius    double precision,
  event_at        timestamptz,
  received_at     timestamptz not null default now(),
  payload         jsonb not null,
  unique (topic, kafka_partition, kafka_offset)
);

create index notices_feed_idx on notices (received_at desc, id desc);
create index notices_kind_idx on notices (kind);

create table service_state (
  key   text primary key,
  value jsonb not null
);
```

Пагинация — **курсорная** по `(received_at, id)`, не `OFFSET`: лента постоянно пополняется
сверху, offset поедет на первом же новом событии.

### 3.4 Реалтайм-мост

`ingestor` после успешной вставки делает `pg_notify('gcn_notice', id::text)`.

В `frontend` — **один singleton-клиент** `pg` с `LISTEN gcn_notice` на процесс, который
мультиплексирует уведомления в SSE-подписчиков. В `NOTIFY` уходит только id (payload
ограничен 8 КБ), полную строку сервер добирает `SELECT`.

Почему не прямой WS из ingestor в браузер: тогда фронт и воркер связаны сетевым контрактом и
масштабируются вместе. `LISTEN/NOTIFY` оставляет Postgres единственной точкой связи.

### 3.5 API

| Роут | Назначение |
|---|---|
| `GET /api/notices?before=<cursor>&limit=20` | Курсорная пагинация истории (для подгрузки вверх) |
| `GET /api/stream` | SSE-поток новых событий |
| `GET /api/health` | Статус ingestor: время последнего heartbeat, лаг |

SSE в Pages Router: `res.flushHeaders()`, `config = { api: { bodyParser: false, responseLimit: false } }`,
комментарий-пинг `:ping\n\n` раз в 15 с (иначе прокси рвёт соединение), очистка подписки на
`req.on("close")`.

⚠️ **nginx:** нужен `proxy_buffering off` и заголовок `X-Accel-Buffering: no`, иначе SSE
буферизуется и события приходят пачками с задержкой. Правка в `ansible/templates/nginx.conf`.

## 4. Фронтенд

### 4.1 FSD-раскладка

```
src/
  entities/notice/          model (типы, zod, mappers) + ui (карточки по kind)
  features/notice-feed/     model (zustand store), api (fetchNotices),
                            lib/use-notice-stream (EventSource + backoff + дедуп)
  widgets/notice-feed/      скролл-контейнер, анимации вставки, «N новых»
  widgets/hero-metaballs/   lib/renderer.ts, lib/shaders/*.glsl, model/hero-store.ts
  _pages/feed/              композиция страницы
  shared/api/db/            пул pg, запросы, LISTEN-клиент
```

SSR: `getServerSideProps` делает **прямой SELECT** последних 20 (не HTTP-запрос к самому себе),
кладёт в `pageProps.cms` → первый рендер уже с контентом. Дальше клиент открывает SSE.

### 4.2 Поведение ленты

Контейнер: `flex-direction: column; justify-content: flex-end`, собственный скролл,
`overflow-anchor: none` — позицию держим сами.

- **Новое событие:** карточка входит снизу (`y: 24, opacity: 0, blur: 6px → 0`), одновременно
  контейнер доскроллен на её высоту тем же easing — читается как единое выталкивание, а не
  «дёрнулось и приехало».
- **Пользователь проскроллил вверх** (>120 px от низа) — ленту не дёргаем, копим счётчик,
  показываем пилюлю «↓ N новых».
- **История сверху:** IntersectionObserver-сентинел; перед вставкой запоминаем
  `scrollHeight`/`scrollTop`, после — компенсируем дельту в `useLayoutEffect`. Без компенсации
  лента прыгает на каждой подгрузке.
- **Штормы:** GW-алерты приходят пачками — батчим вставки окном 100 мс.
- **Лимит DOM:** ≤500 карточек, лишнее обрезаем сверху в live-режиме. Полноценная
  виртуализация — потом, если понадобится.
- `prefers-reduced-motion` → вставка без анимации.

### 4.3 Hero: metaballs

Fullscreen-треугольник, один фрагментный шейдер WebGL2, raymarching:

- **Форма:** SDF-сферы (1 большая + 3–5 орбитальных + «курсорная»), объединение через
  polynomial `smin` (k ≈ 0.35). Отрыв и «шейка» возникают из самой геометрии, их не нужно
  подделывать.
- **Чёрное зеркало:** `albedo ≈ 0.02`, `reflect(rd, normal)` сэмплит процедурное окружение,
  Френель по Шлику — центр почти чёрный, края вспыхивают отражением.
- **Небо:** то же `env(rd)` для лучей мимо шара — hash-звёзды по направлению, fbm-туманность,
  параллакс слоёв от мыши. Один источник для фона и для отражения — они согласованы по определению.
- **Курсор:** unproject указателя на плоскость `z = 0`, курсорный шар тянется пружиной с
  критическим демпфированием; вдали от главного — отрывается, вблизи — сливается. Тач через
  `pointermove` / `touchmove`; без указателя шар возвращается на орбиту.

**Перформанс и фолбэки:**

- DPR-кап 1.75; half-res в фоновой фазе; пауза `rAF` на `document.hidden`;
- адаптивное качество по FPS (в проекте уже есть `widgets/fps` и `widgets/performance-detect`);
- `prefers-reduced-motion` → один статичный кадр, курсор не отслеживается;
- нет WebGL2 → статичный постер.

Целевые цифры: ≥55 FPS на ноутбуке, ≥30 FPS на мобильном.

### 4.4 Переход intro → background

⚠️ Канвас живёт **выше ленты в дереве** (в layout, не внутри страницы). Если положить его в
страницу, при переходе пересоздаётся WebGL-контекст — фриз и мигание.

По клику — один GSAP-таймлайн:

1. `heroStore.setPhase("background")`;
2. uniforms: камера отъезжает, шар уменьшается, `uEnvIntensity` падает;
3. CSS: `opacity → 0.55`, лёгкий blur (дешевле считать в шейдере, чем CSS-фильтром);
4. hero-текст уходит через `SplitText` из `shared/ui/animations`;
5. лента въезжает со stagger.

Обратный переход (кнопка / `Esc`) — `.reverse()` того же таймлайна.

## 5. Этапы

### Этап 0 — чистка и каркас

- Удалить Strapi (`@strapi/*`, `src/shared/api/strapi`, `src/shared/content-types`,
  `shared/ui/media-image`, `_pages/products`, `src/pages/about.tsx`, `api/preview`, `api/exit-preview`),
  imgproxy (`shared/config/img-proxy.ts`, rewrites в `next.config.js`), Meilisearch.
- Почистить `docker-compose*.yml`, `ci/env/*`, `.env.sample`, `ansible`.
- ⚠️ На Strapi завязаны оркестратор `getServerSidePropsData` и `_app` через `pageProps.cms` —
  их надо **переключить на Postgres**, а не удалить, иначе главная падает.
- Переименовать проект (`package.json` → `nasa-notifications`), обновить README.
- Удалить неактуальные скиллы (`creating-strapi-*`, `strapi-*`, `cms-content-rendering`,
  `responsive-images`) и парные `.cursor/rules/*.mdc`.

**Проверка:** `pnpm dev`, `pnpm check`, `tsc --noEmit -p tsconfig.json` — зелёные.

### Этап 1 — ingestor ✅

Пакет `services/ingestor`, `gcn-kafka` + `pg`, парсеры, дедуп, catch-up, healthcheck,
Dockerfile, сервис в compose, миграции БД.

**Проверка:** строки появляются в `notices`, heartbeat тикает, повторный запуск не плодит дубли.

Что сделано и на что смотреть:

- **`gcn-kafka` зафиксирован на `0.3.0`** (поверх `kafkajs`). В `1.0.0` библиотека переехала
  на `@confluentinc/kafka-javascript` — это нативный librdkafka, который в alpine-образе
  пришлось бы собирать из исходников. Не обновлять без нужды.
- `@mongodb-js/zstd` (транзитивный, часть топиков сжата) внесён в `allowBuilds`
  `pnpm-workspace.yaml` — иначе pnpm блокирует его install-скрипт и импорт падает.
- Миграции — обычные `.sql` в `services/ingestor/sql/`, применяются при старте воркера с
  отметкой в `schema_migrations`. Отдельной библиотеки миграций нет намеренно.
- `event.skymap` из `igwn.gwalert` вырезается перед записью: это base64-FITS в несколько
  мегабайт на сообщение.
- Вставка батчем: один `INSERT ... ON CONFLICT DO NOTHING` + `pg_notify` внутри того же
  CTE — уведомление уходит только по реально добавленным строкам.
- Моковый продюсер `pnpm --filter ingestor seed [--loop]` гоняет фикстуры через боевые
  парсеры (нужен этапу 3: GCN молчит часами).

### Этап 2 — API ✅

`shared/api/db` (пул, запросы, LISTEN-клиент), `GET /api/notices`, `GET /api/stream`, `GET /api/health`.

**Проверка:** `curl -N localhost:3000/api/stream` льёт события в реальном времени.

Что сделано и на что смотреть:

- Пул и LISTEN-клиент кэшируются в `globalThis`: в dev Next пересоздаёт модули на каждый
  hot-reload, без кэша копятся соединения и дублируются слушатели.
- Курсор — строка `<epoch_ms>_<id>`, сравнение строкой `(received_at, id) < ($1, $2)`:
  ложится на индекс `notices_feed_idx`. Некорректный курсор — 400, не пустая страница.
- `payload` наружу не отдаётся: карточкам хватает нормализованных полей, а сырое сообщение
  тяжёлое.
- В SSE доборы строк по id сериализованы цепочкой промисов — параллельные `SELECT`'ы
  вернулись бы вразнобой и порядок в ленте поехал бы.
- Поддержан `Last-Event-ID`: при реконнекте браузер шлёт id последнего события, сервер
  доигрывает пропуск (`getNoticesAfter`), иначе в ленте остаётся дыра.
- `/api/health` отвечает 200 и при `stale` — протухший heartbeat это состояние в теле, а не
  ошибка роута. Порог — 120 с (ingestor тикает раз в ~30 с).
- nginx под SSE (`proxy_buffering off`, длинные таймауты) уже описан в
  `ansible/templates/nginx.conf`.

### Этап 3 — лента ✅

`entities/notice`, `features/notice-feed`, `widgets/notice-feed`, SSR первых 20, SSE-клиент с
reconnect, анимации вставки, «N новых», подгрузка истории вверх.

**Проверка:** моковый продюсер (события раз в 2 с) — иначе анимации не отладить, GCN молчит часами.

Что сделано и на что смотреть:

- **Store ленты создаётся на монтирование страницы, через провайдер, а не модулем-синглтоном.**
  В zustand серверный снимок берётся из начального состояния store, поэтому наполнить синглтон
  перед первым рендером нельзя — SSR отдал бы пустую ленту. Заодно на сервере модульный store
  был бы общим на все запросы. Начальные данные приходят в `createNoticeFeedStore(page)`.
- В сторе события лежат **от старых к новым** (лента-мессенджер), а БД отдаёт от новых к старым —
  разворот один, в фабрике стора и в `prependHistory`.
- Скролл-контейнер помечен `data-lenis-prevent`: страница скроллится Lenis'ом, без этого атрибута
  колесо над лентой уезжало бы в общий скролл.
- Список прижат к низу через `margin-top: auto`, а не `justify-content: flex-end` на скролл-контейнере:
  при переполнении flex-end обрезает верх и до него не доскроллить.
- Компенсация скролла при подгрузке истории — в `useLayoutEffect` по сохранённому с прошлого кадра
  `scrollHeight`, до отрисовки. Плюс `overflow-anchor: none`: браузерный якорь мешает считать самим.
- SSE-события батчатся окном 100 мс (GW приходят пачками), дедуп по id — SSR и поток пересекаются.
- Реконнект в основном штатный, силами `EventSource` (он же шлёт `Last-Event-ID`); ручной ретрай
  с backoff нужен только когда браузер закрыл соединение окончательно (`readyState === CLOSED`).
- Обрезка DOM до 500 карточек — только когда пользователь внизу: иначе уедет позиция скролла.
- Проверено в headless Chrome по CDP при работающем `seed --loop`: SSR-карточки, автоскролл вниз,
  живые вставки, пилюля «N новых» при уходе вверх, подгрузка истории без прыжка.

### Этап 4 — hero

WebGL2-рендерер, шейдер metaballs + звёздное небо + отражение, взаимодействие с курсором, фолбэки.

**Проверка:** FPS по целям из 4.3, корректный `destroy()` при unmount (нет утечки контекста).

### Этап 5 — переход и полировка

Таймлайн intro → background, композиция слоёв, a11y, `prefers-reduced-motion`, SEO/OG,
деплой (compose + CI + nginx под SSE).

### Этап 6 — проверка

`pnpm check`, `tsc --noEmit`, скилл `web-quality-audit` по отданному дев-серверу, ревью по `mr-review`.

## 6. Переменные окружения

```
GCN_CLIENT_ID=
GCN_CLIENT_SECRET=      # только на сервере, никогда не NEXT_PUBLIC_*
GCN_TOPICS=             # csv, дефолт — список из ТЗ
GCN_BACKFILL_DAYS=7
GCN_CONSUMER_GROUP=nasa-notifications

DATABASE_URL=postgres://...
NOTICES_LIVE_LIMIT=500
```

⚠️ `client_secret`, использовавшийся при постановке задачи, засвечен в переписке — **перевыпустить**
на gcn.nasa.gov до первого деплоя. В `.env.sample` — пустые ключи.

## 7. Риски

| Риск | Смягчение |
|---|---|
| Разнородные форматы топиков | Адаптеры + жёсткий fallback, `kind: "unknown"` рендерится как сырой текст |
| SSE режется прокси | `proxy_buffering off`, `X-Accel-Buffering: no`, пинг раз в 15 с |
| Штормы событий (GW идут пачками) | Батчинг вставок, лимит DOM, батчинг записи в БД |
| Часть топиков недоступна аккаунту | Ловим `TOPIC_AUTHORIZATION_FAILED`, продолжаем с остальными |
| Дубли при рестарте воркера | `unique (topic, partition, offset)` + `ON CONFLICT DO NOTHING` |
| Просадка FPS на слабых устройствах | Адаптивное качество, half-res, статичный фолбэк |
| Долгое молчание GCN | Catch-up на 7 дней при старте + моковый продюсер в dev |

## 8. Инвентаризация к этапу 0

Собрано разбором репозитория до начала работ — чтобы не пересобирать заново.

### 8.1 Файлы, завязанные на Strapi / imgproxy / Meilisearch

**Удалить целиком:** `src/shared/api/strapi/` (кроме оркестратора, см. ниже),
`src/shared/content-types/`, `src/shared/types/strapi-components/`, `src/shared/ui/media-image/`,
`src/shared/utils/imgproxy.ts`, `src/shared/utils/normalize-image-source-url.ts`,
`src/shared/config/img-proxy.ts`, `src/entities/article/`, `src/_pages/products/`,
`src/pages/products/`, `src/pages/about.tsx`, `src/pages/api/preview.ts`,
`src/pages/api/exit-preview.ts`, `src/pages/api/revalidate.ts`, `src/shared/ui/preview-banner/`.

**Переписать, не удалять:**

- `src/shared/api/strapi/getServerSidePropsData.ts` — оркестратор хороший (изоляция ошибок по
  ключу, вывод типов из карты запросов). Переехать в `src/shared/api/server-data/`, выкинуть
  домешивание `commonData` из Strapi.
- `src/app/model/data-store/global-data.ts` — импортирует `CommonData` из Strapi-слоя;
  переопределить под свои глобальные данные (или убрать `commonData` вовсе).
- `src/shared/api/sitemap/` — `crawl-collection.ts` обходит коллекции Strapi; оставить только
  статические маршруты (`static-pages.ts`).
- `src/shared/api/cache/tags.ts` — теги завязаны на модели CMS; для горячей ленты кэш не нужен,
  оставить только под статику.
- `src/shared/config/api.ts` — целиком про Strapi (`STRAPI_CONFIG`, `baseUrl`), заменить на
  конфиг БД/ingestor.

### 8.2 Подводный камень: SEO-слой цепляется только за типы

`src/widgets/seo-layout/` (seo-layout, ld-json, og-tags, build-schema) импортирует из
`@shared/types/strapi-components` **только типы** — `Seo`, `Organization`, `LinkSocial`, `Image`.
Рантайм-зависимости от Strapi там нет.

Поэтому SEO **не надо переписывать**: достаточно перенести эти четыре типа в
`src/shared/types/seo.ts` (они самодостаточны, ~90 строк) и починить импорты. Попытка «заодно
переделать SEO» на этапе 0 — лишний риск.

### 8.3 Подводный камень: rewrite `/api/*` в next.config.js

```js
{ source: "/api/:path*", destination: `${baseUrl}/:path*` }  // → Strapi
```

Сейчас **весь** `/api/*` проксируется в Strapi. Если его не убрать, собственные роуты
(`/api/notices`, `/api/stream`) работать не будут — запросы уйдут в несуществующий бэкенд.
Убирается вместе с imgproxy-rewrite.

### 8.4 Зависимости

**Убрать:** `@strapi/client`, `@strapi/blocks-react-renderer`, `@imgproxy/imgproxy-node`, `imgproxy`.
**Добавить:** `pg`, `@types/pg`.
**Не трогать** (используются): `html-react-parser`, `nodemailer`, `lru-cache`, `lodash.isequal`,
`ua-parser-js`, `normalize-wheel-es`, `transition-hook`, `gsap`, `lenis`, `zustand`, `zod`.
**Не используются нигде в `src/`** (кандидаты на удаление отдельным проходом, не на этапе 0):
`axios`, `ky`, `typograf`, `swiper`, `eslint-config-next`.

### 8.5 Прочее

- `pnpm-workspace.yaml` уже есть (пока только `allowBuilds`) — `services/ingestor` встанет туда
  как пакет воркспейса.
- `yarn.lock` в корне рядом с `pnpm-lock.yaml` — рудимент, удалить.
- Документы `docs/05-image-proxy.md`, `docs/06-meilisearch.md`, `docs/07-strapi-preview.md`
  теряют смысл целиком; `11-server-cache.md` и `12-sitemap.md` — частично (примеры на Strapi).
