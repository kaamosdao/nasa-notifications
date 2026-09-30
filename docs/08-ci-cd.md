# CI/CD — сборка и деплой через GitHub Actions

## 📋 Обзор

Весь пайплайн — один workflow [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), один job:

```
push в main
   │
   ├─ генерация *.env из ci/env/*.env.tpl (envsubst + секреты репозитория)
   ├─ сборка и push образов frontend / ingestor в GHCR
   └─ SSH на прод: scp compose + env → docker compose pull && up -d
```

Почему один job, а не `build` + `deploy` по отдельности: env-файлы содержат пароль БД и секреты GCN. Разделение потребовало бы передавать их между джобами артефактом, то есть класть секреты в хранилище артефактов репозитория. В одном job они живут только в рабочей директории раннера.

> Раньше здесь был GitLab CI с переиспользуемым компонентом `saltpepper/ci-components`. Он остался в студийном boilerplate; на GitHub компонент недоступен, поэтому `.gitlab-ci.yml` удалён, а его стадии `prepare → build → deploy` воспроизведены шагами workflow.

## 🔑 Что завести в настройках репозитория

**Settings → Secrets and variables → Actions.** Часть значений — секреты, часть — обычные переменные (они видны в логах, и это нормально).

### Secrets

| Секрет | Что это |
|---|---|
| `SSH_HOST` | IP прод-сервера |
| `SSH_USER` | Deploy-пользователь; **обязан совпадать с `project_user` в Ansible** |
| `SSH_PRIVATE_KEY` | Приватный ключ, чей `.pub` лежит в `ansible/keys/` (у нас — `ci.pub`) |
| `DATABASE_USERNAME` | Пользователь Postgres |
| `DATABASE_PASSWORD` | Пароль Postgres |
| `DATABASE_NAME` | Имя БД |
| `GCN_CLIENT_ID` | Client ID gcn.nasa.gov |
| `GCN_CLIENT_SECRET` | Client Secret gcn.nasa.gov |
| `ANTHROPIC_API_KEY` | Ключ API Claude; нужен только при `LLM_PROVIDER=anthropic` (иначе workflow его не требует) |

`GITHUB_TOKEN` заводить не нужно — GitHub выдаёт его каждому запуску сам.

### Variables

| Переменная | Назначение | Если не задать |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Публичный URL сайта (`https://gcn.testing-nasa-notifications.com`) | ❌ workflow падает |
| `GCN_TOPICS` | csv топиков | пусто → дефолтный список ingestor'а |
| `GCN_BACKFILL_DAYS` | Глубина первичной загрузки | `7` |
| `GCN_CONSUMER_GROUP` | Consumer group Kafka | `nasa-notifications-production` |
| `NOTICES_LIVE_LIMIT` | Карточек в DOM в live-режиме | `500` |
| `NEXT_PUBLIC_YANDEX_TRACKING_ID` | Счётчик | пусто |
| `LLM_PROVIDER` | Кто отвечает в AI-чате: `ollama` \| `anthropic` | `ollama` |
| `OLLAMA_CHAT_MODEL` | Чат-модель Ollama | `qwen3:4b` |
| `OLLAMA_EMBED_MODEL` | Модель эмбеддингов | `nomic-embed-text` |
| `OLLAMA_NUM_PARALLEL` | Параллельных генераций Ollama | `1` |
| `ANTHROPIC_MODEL` | Модель Claude | `claude-sonnet-5-5` |
| `ANTHROPIC_EFFORT` | `low` \| `medium` \| `high` \| `none` (`none` — для `claude-haiku-4-5`) | `low` |
| `CHAT_RATE_PER_MIN` / `CHAT_RATE_PER_DAY` | Вопросов с IP в минуту / сутки | `10` / `50` |
| `CHAT_DAILY_CAP` | Общий потолок вопросов в сутки | `1000` |

Смысл переменных AI-чата — [03-environment-variables.md](./03-environment-variables.md#-ai-чат).
Смена провайдера или модели — правка переменной и перезапуск workflow (`workflow_dispatch`),
код не меняется.

Workflow проверяет обязательные значения **до** сборки и падает с понятным `::error::`, а не через десять минут на упавшем контейнере.

### ⚠️ `DATABASE_URL` секретом не заводится

Он собирается в workflow из трёх составляющих:

```bash
DATABASE_URL="postgres://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@postgres:5432/${DATABASE_NAME}"
```

Хост внутри compose-сети — всегда `postgres` (имя сервиса). Отдельный секрет с полным URL — постоянный источник аварии: туда копируют локальную строку с `@localhost`, и контейнеры на сервере базу не находят, хотя она рядом и здорова.

## 📦 Образы (GHCR)

```
ghcr.io/<owner>/<repo>/frontend:<sha7>   + :latest
ghcr.io/<owner>/<repo>/ingestor:<sha7>   + :latest
```

GHCR принимает только нижний регистр, поэтому `github.repository` приводится к lowercase в шаге *Resolve image base and tag*.

Тег `<sha7>` — короткий SHA коммита, неизменяемый: на него можно откатиться. `docker-compose.production.yml` подставляет его через `${VERSION_TAG}` из `.env`, который деплой кладёт рядом с compose:

```
PROJECT_SLUG=nasa-notifications
CI_REGISTRY_IMAGE=ghcr.io/<owner>/<repo>
VERSION_TAG=<sha7>
```

Имена `CI_REGISTRY_IMAGE` / `VERSION_TAG` достались от GitLab — их оставили, чтобы не трогать compose.

### Откат на предыдущую версию

```bash
ssh <user>@<host>
cd /var/www/<user>
sed -i 's/^VERSION_TAG=.*/VERSION_TAG=<нужный sha7>/' .env
docker compose -f docker-compose.production.yml up -d
```

### ⚠️ `docker login` на сервере живёт только во время деплоя

Пул образов на сервере идёт под `GITHUB_TOKEN`, который **действителен только пока выполняется job**. Сразу после `up -d` workflow делает `docker logout`.

Последствие: `docker compose pull` руками на сервере позже упадёт с `denied`. Уже скачанные образы при этом работают и переживают рестарт — `up -d` и `restart` не требуют реестра. Нужен ручной pull — залогиньтесь своим PAT с правом `read:packages`:

```bash
echo <PAT> | docker login ghcr.io -u <github-username> --password-stdin
```

## 🏗️ Сборка

Оба образа собираются `docker/build-push-action` с кешом GitHub Actions (`type=gha`, отдельный `scope` на сервис — иначе они затирали бы кеш друг друга).

**Фронту нужен `frontend.env` во время сборки**: `NEXT_PUBLIC_*` впекаются в бандл на `pnpm build`. Он передаётся секретом BuildKit:

```yaml
secret-files: |
  frontend_env=frontend.env
```

а не `--build-arg` — аргумент сборки остался бы в истории слоёв опубликованного образа и читался бы любым, кто скачал образ.

Ingestor секретов на сборке не требует: он читает окружение в рантайме из `ingestor.env`.

## 🚀 Деплой

```
scp docker-compose.production.yml .env frontend.env ingestor.env postgres.env ollama.env
    → /var/www/$SSH_USER/
ssh → chmod 600 на env-файлы → docker login → compose pull → up -d --remove-orphans → logout
    → фоновый kb:index
```

- `--remove-orphans` убирает контейнеры сервисов, удалённых из compose (наследие Strapi/imgproxy/meili);
- `chmod 600` — в env-файлах пароль БД и секреты GCN;
- ключ хоста добавляется через `ssh-keyscan` в `known_hosts`, а не отключением `StrictHostKeyChecking`: с `no` деплой уехал бы на чужой сервер при подмене DNS.

`concurrency: cancel-in-progress` гарантирует, что два выката не столкнутся на одном сервере.

### База знаний AI-чата (`kb:index`)

После `up -d` деплой запускает разовый контейнер `${PROJECT_SLUG}_kb-index` (`compose run -d`
из образа ingestor): он ждёт, пока ollama скачает модель эмбеддингов, и индексирует справку
и архив циркуляров за 3 года. Первый выкат наполняет базу (долго: эмбеддинги на CPU), следующие
пропускают неизменённое, добирают пропущенное и удаляют циркуляры старше окна. Деплой прогон
не ждёт; прошлый незавершённый прогон удаляется и начинается заново — индексация идемпотентна.
Новые циркуляры между деплоями индексирует сам ingestor.

```bash
docker logs -f nasa-notifications_kb-index    # прогресс раз в 500 документов, в конце «готово»
```

У `run`-контейнера restart policy `no`: после выхода он не перезапускается, а остаётся
остановленным с логами до следующего деплоя.

## 🩺 Порядок запуска контейнеров

```
postgres (healthy) ─┬─▶ ingestor
                    └─▶ frontend
ollama (независимо; первый старт качает модели в volume)
```

`ingestor` и `frontend` ждут `service_healthy` у Postgres. От ollama они не зависят: пока её нет,
лента работает, а чат отвечает без векторного поиска. У `ingestor` `stop_grace_period: 20s` — по SIGTERM он вызывает `consumer.disconnect()`, иначе ребалансировка consumer-группы висит до таймаута.

## 🌐 Порты и nginx

`docker-compose.production.yml` публикует порты **только на `127.0.0.1`**:

| Сервис | Публикация |
|---|---|
| `frontend` | `127.0.0.1:3000` — наружу его отдаёт системный nginx |
| `postgres` | `127.0.0.1:5432` — только локально (psql, дампы, `ssh -L`) |
| `ingestor` | не публикуется |
| `ollama` | не публикуется — доступна только по внутренней сети |

Публикация на `0.0.0.0` открыла бы Postgres в интернет: **docker публикует порты в обход ufw/iptables**, фаервол на сервере это не закрывает.

Reverse-proxy и TLS настраивает Ansible — [10-ansible-playbook.md](./10-ansible-playbook.md).

## 🇷🇺 npm-реестр

В Dockerfile'ах есть `ARG NPM_REGISTRY` с дефолтом `https://registry.npmjs.org`. Раннеры GitHub в npmjs ходят свободно, поэтому workflow его не переопределяет. Зеркало GitVerse нужно было для раннеров из РФ — включается `--build-arg NPM_REGISTRY=https://npm-mirror.gitverse.ru` при ручной сборке.

## 🛠️ Частые ошибки

| Симптом | Причина | Решение |
|---|---|---|
| `Required variable X is empty` | Не заведён секрет/переменная | Settings → Secrets and variables → Actions |
| `Permission denied (publickey)` на шаге деплоя | В `SSH_PRIVATE_KEY` не тот ключ, или его `.pub` не раскатан на сервер | Проверить, что `ansible/keys/ci.pub` — пара к секрету, и прогнать плейбук |
| `denied` при `docker compose pull` руками | Токен деплоя уже истёк | `docker login ghcr.io` своим PAT (`read:packages`) |
| Контейнер не находит БД | `DATABASE_URL` с `localhost` | URL собирается workflow с хостом `postgres`; свой секрет с URL не заводить |
| `ERR_PNPM_IGNORED_BUILDS` | Build-скрипт зависимости не одобрен | Добавить пакет в `allowBuilds` в `pnpm-workspace.yaml` |
| Лента «залипает», события пачками | Буферизация SSE на nginx | Проверить локацию `/api/stream` в `ansible/templates/nginx.conf` |
| `LLM_PROVIDER=anthropic requires secret ANTHROPIC_API_KEY` | Провайдер Claude без ключа | Завести секрет или вернуть `LLM_PROVIDER=ollama` |
| Чат: `credit balance is too low` в логе frontend | Пустой баланс API (подписка Claude Pro его не пополняет) | console.anthropic.com → Billing |
| Чат отвечает без циркуляров | `kb:index` не дошёл до конца | `docker logs nasa-notifications_kb-index` |

Логи на сервере:

```bash
ssh <user>@<host>
cd /var/www/<user>
docker compose -f docker-compose.production.yml logs -f frontend ingestor
```

## 🔗 Связанные документы

- [Ansible — подготовка прод-сервера](./10-ansible-playbook.md)
- [Переменные окружения](./03-environment-variables.md)
- [Docker Compose](./04-docker-compose.md)
