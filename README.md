# NASA / GCN Notifications

Сайт, который в реальном времени показывает поток научных оповещений
[GCN (General Coordinates Network, NASA)](https://gcn.nasa.gov/): гравитационные волны,
гамма-всплески, быстрые радиовсплески, нейтринные события, циркуляры.

Две сцены на одной странице: полноэкранный WebGL-hero (чёрный зеркальный metaball на фоне
звёздного неба) и лента оповещений, которая ведёт себя как мессенджер — новые события
приходят снизу, история подгружается сверху.

Целевая архитектура, принятые решения и этапы работ — в [плане проекта](./docs/15-plan.md).
Это источник правды; профильные документы подтягиваются к нему по мере реализации.

## 🏗 Архитектура

```
GCN (Kafka/SASL) → ingestor (Node) → Postgres → SSE → браузер
```

Три сервиса в `docker-compose`: `ingestor` (консьюмер Kafka, парсинг и нормализация),
`frontend` (Next.js: SSR ленты, SSE-поток, API) и `postgres` (история событий).

## 🚀 Быстрый старт

1. Скопируйте `.env.sample` в `.env` и заполните значения
   (см. [03-environment-variables.md](./docs/03-environment-variables.md)).
2. Запустите стек:
   ```bash
   docker compose up -d
   ```
3. Откройте http://localhost:3000

Учётные данные GCN (`GCN_CLIENT_ID` / `GCN_CLIENT_SECRET`) выпускаются на
[gcn.nasa.gov](https://gcn.nasa.gov/) и живут только на сервере — никогда не в `NEXT_PUBLIC_*`.

## 📚 Документация

- [Структура проекта и FSD архитектура](./docs/01-project-structure.md)
- [Пакеты проекта и Biome](./docs/02-packages-and-biome.md)
- [Переменные окружения](./docs/03-environment-variables.md)
- [Запуск через Docker Compose](./docs/04-docker-compose.md)

Полное оглавление — [README в docs/](./docs/README.md).

## 🛠️ Технологии

- **Next.js 15** (Pages Router) — SSR ленты, API-роуты, SSE
- **TypeScript 5.9** — типизация
- **PostgreSQL 16** — история оповещений, `LISTEN/NOTIFY` как реалтайм-мост
- **gcn-kafka** — консьюмер потока GCN
- **WebGL2** — hero-сцена (raymarching, без сторонних 3D-библиотек)
- **Feature-Sliced Design** — архитектура фронтенда
- **Biome** — линтер и форматтер
- **Docker Compose** — локальная разработка и деплой
