# Ansible — подготовка прод-сервера

> ⚠️ **Документ ещё описывает конфигурацию студийного boilerplate (Strapi / imgproxy /
> Meilisearch).** Эти сервисы удалены на этапе 0; документ будет переписан на этапе 5
> вместе с финальным деплоем. Источник правды по архитектуре — [план проекта](./15-plan.md).

## 📋 Обзор

В `ansible/` два плейбука и интерактивный раннер:

| Что | Файл | Назначение |
|---|---|---|
| **Инициализация сервера** | `playbooks/prod-routine.yml` | однократная подготовка свежего Ubuntu-сервера под деплой |
| **Перенос данных** | `playbooks/migrate-data-to-prod.yml` | Postgres + uploads на прод (из локального Docker или с другого сервера) |
| **Раннер** | `run.sh` | меню, вопросы, временный inventory, запуск нужного плейбука |

`prod-routine.yml` ставит и настраивает всё, чего ожидает CI-джоб `deploy_production`:

- **Docker CE** + плагины (`buildx`, **`compose` v2**) — для запуска контейнеров проекта;
- **системный nginx** как reverse-proxy к контейнерам (порты `3000/1337/8080/7700` на `localhost`) с кешированием;
- **certbot** (+ плагин nginx) — для TLS-сертификатов Let's Encrypt;
- **deploy-пользователя** (`project_user`) в группе `docker`, с SSH-ключом и каталогом `/var/www/<project_user>`.

После прогона сервер готов принимать деплой: CI по SSH заходит как `project_user` в `/var/www/<project_user>` и выполняет `docker compose -f docker-compose.production.yml up -d` (см. [08-ci-cd.md](./08-ci-cd.md)).

> ⚠️ Прод использует **системный nginx**, а не `nginx-proxy` из testing-compose. На проде `docker-compose.production.yml` пробрасывает порты на `localhost`, а маршрутизацию/TLS делает nginx, поднятый этим плейбуком.

## 📁 Структура

```
ansible/
├── ansible.cfg                   # inventory=inventory, host_key_checking=False
├── run.sh                        # интерактивное меню: setup / migrate
├── inventory/
│   └── hosts.ini                 # пример хостов (для ручного запуска без меню)
├── playbooks/
│   ├── prod-routine.yml          # инициализация сервера
│   ├── migrate-data-to-prod.yml  # перенос Postgres + uploads (2 play'я)
│   └── tasks/
│       └── migrate-from-remote-source.yml
├── templates/
│   └── nginx.conf                # Jinja-шаблон reverse-proxy (server_name из domain)
└── keys/
    └── <project_user>.pub        # SSH public key деплой-пользователя
```

### `ansible.cfg`

```ini
[defaults]
inventory = inventory
host_key_checking = False      # не спрашивает подтверждение host key при первом коннекте
interpreter_python = auto_silent
```

## ⚠️ Дефолты в шаблоне — от предыдущих проектов

`run.sh` и `inventory/hosts.ini` содержат **реальные значения прошлых проектов** в качестве дефолтов: домен `familydom-production.snpdev.ru`, пользователь `familydom`, IP `109.73.197.61`. Каталог `keys/` тоже может содержать чужие ключи.

При старте нового проекта — **заменить**, иначе `run.sh` предложит их как готовые варианты и легко нажать Enter не глядя.

## ✅ Требования (control-машина)

- **Ansible** (локально, откуда запускаете);
- коллекция **`ansible.posix`** (используется `authorized_key`):
  ```bash
  ansible-galaxy collection install ansible.posix
  ```
- SSH-доступ к серверу (`root`/`ubuntu` или другой user) с sudo;
- локально должны существовать:
  - `ansible/keys/<project_user>.pub` — публичный ключ деплой-пользователя, **непустой и валидного формата**;
  - `ansible/templates/nginx.conf`.

`pre_tasks` проверяет наличие обоих файлов и формат ключа (`ssh-rsa` / `ssh-ed25519` / `ecdsa-sha2-nistp256`) и падает, если что-то не так.

> ⚠️ **В файле ключа должна быть ровно одна строка** вида `<тип> <base64> [комментарий]`.
> Модуль `ansible.posix.authorized_key` разбирает содержимое **построчно**, поэтому любая лишняя
> строка (случайно вставленный URL, вторая пара ключей, остаток копипасты) роняет плейбук уже на
> установке ключа:
> ```
> fatal: FAILED! => {"msg": "invalid key specified: https:///"}
> ```
> Проверить перед запуском:
> ```bash
> wc -l ansible/keys/<project_user>.pub     # должно быть 1
> ssh-keygen -l -f ansible/keys/<project_user>.pub
> ```

> Для миграции из локального Docker дополнительно нужен **работающий локальный стек** — см. ниже.

## ▶️ Запуск

```bash
cd ansible
./run.sh
```

Меню:

```
  1) Setup production server
  2) Migrate data to production
       1) From remote server
       2) From local Docker (auto db.dump + uploads)
```

Скрипт спрашивает параметры, собирает **временный inventory** (`mktemp`) и передаёт переменные через `-e`. Временные файлы удаляются по `trap` на выходе, в том числе при ошибке.

### Sudo-пароль

В конце каждого сценария задаётся вопрос **`Ask sudo password on remote?`** — при `y` добавляется `--ask-become-pass`.

Оба плейбука работают с `become: true`, то есть **все задачи идут через sudo**. Отсюда правило:

| Подключаетесь как | Ответ |
|---|---|
| `root` | `n` — sudo не нужен |
| любой другой пользователь | **`y`**, если на сервере не настроен `NOPASSWD` sudo |

`run.sh` подставляет дефолт сам, глядя на `ansible_user` прода и source-хоста: под non-root предлагает `Y` и предупреждает об этом.

Ответ `n` при подключении не под root даёт падение на первой же задаче:

```
fatal: [old-1]: FAILED! => {"msg": "Missing sudo password"}
```

Альтернатива паролю — настроить на сервере `NOPASSWD` для деплой-пользователя:

```bash
echo "creators ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/creators
sudo chmod 0440 /etc/sudoers.d/creators
```

Для ручного запуска без меню — `ansible-playbook playbooks/prod-routine.yml -i inventory/hosts.ini -e "..."`.

## 🗂️ Что спрашивает `run.sh`

**Production host:** `ansible_host` (IP), `ansible_user`.

**Project settings:** `domain` (apex), `project_user`, `project_group`, `project_slug`, `project_dir`.

Из `domain` автоматически собираются поддомены:
- `{{ domain }}` / `www.{{ domain }}` — frontend (+ www→apex redirect)
- `admin.{{ domain }}` — Strapi
- `search.{{ domain }}` — Meilisearch
- `imgproxy.{{ domain }}` — imgproxy

## ⚙️ Переменные

| Переменная | Обязательна | Назначение |
|---|---|---|
| `project_user` | ✅ | Deploy-пользователь = `SSH_USER` из CI; его дом `/var/www/<project_user>` |
| `project_group` | ✅ | Группа-владелец каталогов проекта |
| `project_slug` | ✅ | = `PROJECT_SLUG`; префикс контейнеров и томов |
| `domain` | ✅ | Apex-домен; `admin.` / `search.` / `imgproxy.` / `www.` собираются автоматически |
| `project_dir` | — | `/var/www/{{ project_user }}`; дефолт есть в плейбуке, но `run.sh` спрашивает его всегда |
| `migrate_source` | ✅ для migrate | `remote` или `local` |
| `migrate_backup` | — | бэкап текущих прод-данных перед импортом |
| `migrate_stop_services` | — | стоп `backend`/`imgproxy` на время импорта |
| `migrate_local_db_path` | ✅ если local | путь к дампу; **заполняет `run.sh` сам** |
| `migrate_local_uploads_path` | ✅ если local | путь к выгруженным uploads; **заполняет `run.sh` сам** |
| `source_project_slug` | — | slug на source-сервере (дефолт = `project_slug`) |
| `docker_ubuntu_codename` | — | кодовое имя релиза для apt-репозитория Docker; по умолчанию берётся с хоста (`ansible_distribution_release`) |
| `docker_apt_arch` | — | `amd64`, либо `arm64` на `aarch64`-хостах |
| `nginx_site_name` | — | `{{ project_user }}` |

`project_user` / `project_group` / `domain` **не имеют дефолтов в плейбуке** — на них стоит `assert`. Предпочтительный путь запуска — `./run.sh`.

## 🔧 Что делает `prod-routine.yml` (по шагам)

1. **Проверки** (`pre_tasks`): заданы `project_user` / `project_group` / `domain`; локально есть `nginx.conf` и `keys/<user>.pub`; ключ валидного формата.
2. **Базовые пакеты**: `curl`, `software-properties-common`, `ca-certificates`, `apt-transport-https`, `gnupg`, `lsb-release`, `wget`.
3. **nginx**: установка + `enable`/`start`.
4. **certbot**: `certbot` + `python3-certbot-nginx`.
5. **Docker**: GPG-ключ в `/etc/apt/keyrings/docker.gpg` + apt-репозиторий → `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, `docker-compose-plugin`; группа `docker`; проверка `docker compose version`.
6. **Deploy-пользователь**: `project_user` (shell `/bin/bash`, свой дом, состоит в `docker`).
7. **Кеш-каталоги nginx**: `/var/cache/nginx/api`, `/var/cache/nginx/frontend`.
8. **nginx reverse-proxy**: рендер `templates/nginx.conf` → `sites-available/<user>`, симлинк в `sites-enabled`, удаление `default`, `nginx -t`, рестарт.
9. **Каталог проекта**: `/var/www/<project_user>` во владении `project_user:project_group`.
10. **SSH-доступ**: `~/.ssh` (0700), `authorized_keys` из `keys/<user>.pub` (0600).

### ⚠️ Docker: почему не ставим пакет `docker-compose`

В список пакетов **нельзя** добавлять `docker-compose` — это Compose **v1** из репозитория Ubuntu, ставший transitional-пакетом: он тянет `docker-compose-v2`, а тот кладёт файл
`/usr/libexec/docker/cli-plugins/docker-compose`, который уже принёс `docker-compose-plugin` из репозитория Docker. dpkg падает:

```
dpkg: error processing archive .../docker-compose-v2_*.deb (--unpack):
 trying to overwrite '/usr/libexec/docker/cli-plugins/docker-compose',
 which is also in package docker-compose-plugin
```

Compose v2 приезжает плагином вместе с `docker-ce`, и проект везде использует синтаксис `docker compose` (без дефиса) — отдельный бинарник v1 не нужен. После установки плейбук проверяет это задачей `docker compose version`.

**Если сервер уже в сломанном состоянии** после такой ошибки — почистить и запустить плейбук заново:

```bash
sudo apt-get remove -y docker-compose docker-compose-v2
sudo dpkg --configure -a
sudo apt-get -f install -y
docker compose version
```

### ⚠️ Версия Ubuntu на сервере

Кодовое имя релиза для apt-репозитория Docker берётся **с самого хоста** (`ansible_distribution_release`), а не прибито константой. Раньше здесь был жёстко зашит `jammy`, из-за чего на сервере с другой Ubuntu (например 25.10 «resolute») ставились пакеты для 22.04 и конфликтовали с системными.

Если Docker ещё не опубликовал пакеты под свежий релиз — переопределите вручную ближайшим LTS:

```bash
ansible-playbook playbooks/prod-routine.yml -i inventory/hosts.ini \
  -e "docker_ubuntu_codename=noble ..."
```

Список опубликованных релизов: <https://download.docker.com/linux/ubuntu/dists/>.

## 🌐 `templates/nginx.conf` — reverse-proxy

| Upstream | Порт | Назначение |
|---|---|---|
| `frontend` | 3000 | Next.js |
| `backend` | 1337 | Strapi (в т.ч. `/admin`, `/_health`) |
| `imgproxy` | 8080 | обработка изображений |
| `search` | 7700 | Meilisearch (`/health`) |

У всех upstream включён `keepalive 32`. Есть зоны кеша `frontend_cache` / `api_cache`, заголовок `X-Cache-Status`, редирект `www → apex`.

> ⚠️ `server_name` собираются из `domain`, править шаблон руками не нужно.

> ⚠️ **В шаблоне нет ни одной директивы `listen`** — ни для 80, ни для 443. nginx в этом случае слушает `*:80` по умолчанию, а `listen 443 ssl` и пути к сертификатам дописывает certbot при выпуске. До прогона certbot редирект `www → https://apex` ведёт на ещё не работающий https — это нормально, поправится после выпуска сертификата.

## 🔒 TLS (certbot)

Плейбук ставит certbot, но **сертификаты не выпускает** — нужен уже указывающий на сервер DNS. После прогона и настройки DNS выпустите вручную (подставьте свой `domain`):

```bash
ssh <user>@<server>
sudo certbot --nginx \
  -d example.ru -d www.example.ru \
  -d admin.example.ru \
  -d search.example.ru \
  -d imgproxy.example.ru
```

certbot сам пропишет `listen 443 ssl` и пути к сертификатам и настроит автопродление.

## 📦 Перенос данных (`migrate-data-to-prod.yml`)

Переносит **Postgres** (`pg_dump -Fc` → `pg_restore`) и **uploads**. Meilisearch не трогается — после миграции при необходимости переиндексируйте из Strapi.

Плейбук состоит из **двух play'ев**:

1. `hosts: source` — выгрузка с исходного сервера (выполняется только при `migrate_source=remote`, иначе пропускается);
2. `hosts: production` — импорт на прод.

На проде должен уже стоять стек: контейнер `{{ project_slug }}_postgres` и том `{{ project_slug }}_strapi-uploads`.

Порядок работы: стоп `backend`/`imgproxy` (если выбрано) → бэкап текущих данных в `/var/www/<user>/migrate/<epoch>/backup` → импорт → возврат владельца uploads (uid/gid `1000`, пользователь `node` в контейнере Strapi) → подъём сервисов.

### Local → prod

**Ручной `pg_dump` больше не нужен — `run.sh` делает всё сам:**

```bash
cd ansible
./run.sh   # → 2) Migrate data → 2) From local Docker
```

Скрипт:

1. проверяет, что установлен `docker`;
2. проверяет, что **запущен** контейнер `<project_slug>_postgres` и существует том `<project_slug>_strapi-uploads` — иначе останавливается с понятным сообщением;
3. снимает дамп во временный файл: `docker exec <slug>_postgres pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc`;
4. выгружает uploads: `docker cp` из контейнера `<slug>_backend`, а если его нет — через `docker run` на образе локального postgres (чтобы не тянуть ничего из Docker Hub);
5. подставляет пути в `migrate_local_db_path` / `migrate_local_uploads_path` и удаляет временные файлы по завершении.

> ⚠️ Локальный стек должен быть **поднят** (`docker compose up`), а `project_slug` — совпадать с `PROJECT_SLUG` локального окружения.

### Remote → prod (server → server)

```bash
./run.sh   # → 2) Migrate data → 1) From remote server
```

Скрипт дополнительно спросит IP и пользователя source-сервера и `source_project_slug`.

На source ожидаются контейнер `{{ source_project_slug }}_postgres` и том
`{{ source_project_slug }}_strapi-uploads` — **это slug ДОНОРА**, он часто отличается от
production. Дефолт в `run.sh` подставляет `project_slug` прода, поэтому Enter здесь нажимать нельзя.

#### ⚠️ Обязательное требование: SSH source → production

Файлы едут **напрямую с source на прод** через `rsync`, минуя вашу машину. Значит пользователю
source нужен доступ по ключу к пользователю прода, а тому — `NOPASSWD` sudo (rsync на приёмной
стороне запускается через `--rsync-path=sudo rsync`, и ввести пароль туда некому).

Проверить **до** запуска:

```bash
# 1. Ключ source → production
ssh <source_user>@<source_ip> 'ssh -o BatchMode=yes <prod_user>@<prod_ip> "echo SSH_OK"'

# 2. Беспарольный sudo на проде
ssh <prod_user>@<prod_ip> 'sudo -n true && echo NOPASSWD_OK'
```

Если первая команда даёт `Permission denied` — разложить ключ:

```bash
ssh <source_user>@<source_ip> 'test -f ~/.ssh/id_ed25519 || ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 >/dev/null 2>&1; cat ~/.ssh/id_ed25519.pub' \
  | ssh <prod_user>@<prod_ip> 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && k=$(cat) && touch ~/.ssh/authorized_keys && grep -qxF "$k" ~/.ssh/authorized_keys || echo "$k" >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys'
```

> После миграции этот ключ стоит удалить с прода — он больше не нужен.

**Как выглядит проблема, если не проверить.** Задача `Push exported files from source server to
production` висит бесконечно без вывода: rsync поднимает свою ssh-сессию, та упирается в запрос
пароля, а ответить некому. Выглядит как «очень долгая передача», хотя не передано ни байта.
Диагностика — посмотреть процессы на source: при реальной передаче у `rsync` растёт CPU-время.

```bash
ssh <source_user>@<source_ip> 'ps aux | grep -E "rsync|ssh " | grep -v grep'
```

В `rsync_opts` добавлен `BatchMode=yes`, поэтому теперь такая ситуация падает за ~15 секунд с
`Permission denied` вместо зависания.

## 🔗 Связь с CI/CD

| Что создаёт плейбук | Как использует CI (`deploy_production`) |
|---|---|
| `project_user` + SSH-ключ | заходит по SSH как `SSH_USER` (= `project_user`) |
| `/var/www/<project_user>` | `REMOTE_DIR`, куда `scp` compose + `.env` и запускается `docker compose up` |
| Docker + группа `docker` | `docker compose pull/up` без sudo |
| системный nginx | проксирует контейнеры (порты из `docker-compose.production.yml`) наружу |

Соответствие: значение `SSH_USER` в CI-переменных = `project_user` из плейбука.

## ♻️ Идемпотентность

`prod-routine.yml` можно **прогонять повторно** — задачи идемпотентны (apt-состояния, `creates:` для docker-ключа, `state: present/link`). Повторный запуск безопасно доводит сервер до нужного состояния, например после правки `nginx.conf`.

Плейбук миграции идемпотентным **не является** — каждый прогон импортирует данные заново поверх текущих (с бэкапом, если включён).

## 🔗 Связанные документы

- [CI/CD — сборка и деплой](./08-ci-cd.md)
- [Docker Compose](./04-docker-compose.md)
- [Переменные окружения](./03-environment-variables.md)
