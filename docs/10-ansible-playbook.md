# Ansible — подготовка прод-сервера

## 📋 Обзор

В `ansible/` один плейбук и интерактивный раннер:

| Что | Файл | Назначение |
|---|---|---|
| **Инициализация сервера** | `playbooks/prod-routine.yml` | однократная подготовка свежего Ubuntu-сервера под деплой |
| **Раннер** | `run.sh` | вопросы, временный inventory, запуск плейбука |

`prod-routine.yml` ставит и настраивает всё, чего ожидает CI-джоб `deploy_production`:

- **Docker CE** + плагины (`buildx`, **`compose` v2**) — для запуска контейнеров проекта;
- **системный nginx** как reverse-proxy к контейнеру frontend (`127.0.0.1:3000`) с кешированием статики;
- **certbot** (+ плагин nginx) — для TLS-сертификатов Let's Encrypt;
- **deploy-пользователя** (`project_user`) в группе `docker`, с SSH-ключом и каталогом `/var/www/<project_user>`.

После прогона сервер готов принимать деплой: CI по SSH заходит как `project_user` в `/var/www/<project_user>` и выполняет `docker compose -f docker-compose.production.yml up -d` (см. [08-ci-cd.md](./08-ci-cd.md)).

> ⚠️ Прод использует **системный nginx**, а не `nginx-proxy` из testing-compose. На проде `docker-compose.production.yml` публикует порты **только на `127.0.0.1`**, а маршрутизацию и TLS делает nginx, поднятый этим плейбуком.

### Стек этого проекта

Из боилерплейта остались только три сервиса — Strapi, imgproxy и Meilisearch удалены на этапе 0, и плейбук с ними ничего не делает:

| Контейнер | Порт на хосте | За nginx |
|---|---|---|
| `frontend` (Next.js) | `127.0.0.1:3000` | ✅ весь трафик |
| `ingestor` (GCN → Postgres) | — | нет, наружу не смотрит |
| `postgres` | `127.0.0.1:5432` | нет, только локально |

Плейбука миграции данных здесь **нет и не требуется**: базу наполняет `ingestor` из потока GCN (при старте — backfill за `GCN_BACKFILL_DAYS`), пользовательских uploads в проекте не существует.

## 📁 Структура

```
ansible/
├── ansible.cfg                  # inventory=inventory, host_key_checking=False
├── run.sh                       # вопросы + запуск prod-routine.yml
├── inventory/
│   └── hosts.ini                # пример хоста (для ручного запуска без меню)
├── playbooks/
│   └── prod-routine.yml         # инициализация сервера
├── templates/
│   └── nginx.conf               # Jinja-шаблон reverse-proxy (server_name из domain)
└── keys/
    ├── nasa-notifications.pub   # личный ключ разработчика
    └── ci.pub                   # ключ, которым ходит GitHub Actions
```

Плейбук раскатывает **все** `keys/*.pub`, а не один файл: на сервер должны попасть и твой ключ (зайти руками), и ключ CI. `authorized_key` работает в режиме `present` — добавляет, не затирая уже лежащие.

Приватная пара к `ci.pub` кладётся в секрет `SSH_PRIVATE_KEY` репозитория. Личный приватный ключ в CI не отдаём: у него шире доступ, и отозвать его — значит менять ключ везде, где он используется.

### `ansible.cfg`

```ini
[defaults]
inventory = inventory
host_key_checking = False      # не спрашивает подтверждение host key при первом коннекте
interpreter_python = auto_silent
```

## 💻 Где что стоит

Ansible — «push-based»: **на сервере он не нужен**. Ставится на твой ноутбук, оттуда подключается к серверу по SSH и выполняет задачи. На сервере требуется только sshd и Python (есть в Ubuntu из коробки) — ни агента, ни самого Ansible там не появляется.

| Где | Что нужно | Зачем |
|---|---|---|
| **Ноутбук** (control-машина) | `ansible`, коллекция `ansible.posix`, SSH-доступ к серверу | отсюда запускается `./run.sh` |
| **Сервер** | чистая Ubuntu + SSH + sudo | всё остальное ставит плейбук |
| **GitHub Actions** | секреты репозитория | деплоит уже на подготовленный сервер |

Установка на macOS:

```bash
brew install ansible
ansible-galaxy collection install ansible.posix
ansible --version
```

Разово — сервер готовится один раз. Дальше живёшь на GitHub Actions, а к плейбуку возвращаешься, только если поменял `nginx.conf` или добавил ключ в `keys/`.

## ✅ Требования (control-машина)

- **Ansible** (локально, откуда запускаете);
- коллекция **`ansible.posix`** (используется `authorized_key`):
  ```bash
  ansible-galaxy collection install ansible.posix
  ```
- SSH-доступ к серверу (`root`/`ubuntu` или другой user) с sudo;
- локально должны существовать:
  - хотя бы один `ansible/keys/*.pub` — **непустой и валидного формата**;
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
> for f in ansible/keys/*.pub; do wc -l < "$f"; ssh-keygen -l -f "$f"; done
> ```
> Плейбук проверяет это сам, отдельным `assert` по каждому файлу, но до подключения к серверу — падение будет быстрым и с именем ключа в выводе.

## ▶️ Запуск

```bash
cd ansible
./run.sh
```

Меню:

```
  1) Setup production server
  0) Exit
```

Скрипт спрашивает параметры, собирает **временный inventory** (`mktemp`) и передаёт переменные через `-e`. Временные файлы удаляются по `trap` на выходе, в том числе при ошибке.

Ввод дополнительно чистится от не-ASCII (`sanitize_value`): невидимый байт из копипасты не виден на экране, но превращает `ssh` под `nasa-notifications` в `Permission denied (publickey,password)` — и причина выглядит как проблема доступа, хотя дело во вводе.

### Sudo-пароль

В конце задаётся вопрос **`Ask sudo password on remote?`** — при `y` добавляется `--ask-become-pass`.

Плейбук работает с `become: true`, то есть **все задачи идут через sudo**. Отсюда правило:

| Подключаетесь как | Ответ |
|---|---|
| `root` | `n` — sudo не нужен |
| любой другой пользователь | **`y`**, если на сервере не настроен `NOPASSWD` sudo |

`run.sh` подставляет дефолт сам, глядя на `ansible_user`: под non-root предлагает `Y` и предупреждает об этом.

Ответ `n` при подключении не под root даёт падение на первой же задаче:

```
fatal: [prod-1]: FAILED! => {"msg": "Missing sudo password"}
```

Альтернатива паролю — настроить на сервере `NOPASSWD`:

```bash
echo "nasa-notifications ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/nasa-notifications
sudo chmod 0440 /etc/sudoers.d/nasa-notifications
```

Для ручного запуска без меню — `ansible-playbook playbooks/prod-routine.yml -i inventory/hosts.ini -e "..."`.

## 🗂️ Что спрашивает `run.sh`

**Production host:** `ansible_host` (IP), `ansible_user`.

**Project settings:** `domain`, `project_user`, `project_group`, `project_slug`.

`project_dir` намеренно **не спрашивается** — он выводится как `/var/www/<project_user>`. См. ниже.

### `domain` — что именно туда вводить

Домен проекта: `gcn.testing-nasa-notifications.com`. Он попадает в `server_name` nginx — по нему nginx понимает, какому сайту адресован запрос, и на него же выпускается сертификат.

**До запуска плейбука домен должен указывать на сервер.** У регистратора/в DNS-панели заводится одна A-запись:

```
gcn   A   <IP сервера>
```

(в зоне `testing-nasa-notifications.com`; имя `gcn`, а не полное `gcn.testing-...` — панели дописывают зону сами)

Проверить, что разошлось:

```bash
dig +short gcn.testing-nasa-notifications.com    # должен вернуть IP сервера
```

Сам плейбук DNS не проверяет и без него отработает — nginx просто будет настроен на имя, которое пока никуда не ведёт. А вот **certbot без DNS не выпустит сертификат**: он проверяет владение доменом, обращаясь к нему извне по HTTP.

### ⚠️ `www` для поддомена не нужен

Шаблон nginx умеет редирект `www.<domain>` → `<domain>`, но рендерит его **только для apex-домена** (переменная `nginx_www_redirect`, эвристика — две метки в имени). Для `gcn.testing-nasa-notifications.com` блок не появится, и это правильно: `www.gcn.testing-...` никто не регистрирует, а лишнее имя в запросе сертификата уронило бы выпуск целиком — certbot требует, чтобы проверку прошёл **каждый** домен из `-d`.

Переопределить: `-e nginx_www_redirect=true` (нужно для доменов вида `example.co.uk`, где эвристика по числу меток ошибается).

Поддоменов `admin.` / `search.` / `imgproxy.` в этом проекте нет.

## ⚙️ Переменные

| Переменная | Обязательна | Назначение |
|---|---|---|
| `project_user` | ✅ | Deploy-пользователь = `SSH_USER` из CI; его дом `/var/www/<project_user>` |
| `project_group` | ✅ | Группа-владелец каталогов проекта |
| `project_slug` | ✅ | = `PROJECT_SLUG` (`nasa-notifications`); префикс контейнеров и томов |
| `domain` | ✅ | Apex-домен; `www.` собирается автоматически |
| `project_dir` | — | Выводится как `/var/www/{{ project_user }}`. `run.sh` его не спрашивает; для нестандартного пути — `-e project_dir=...` при ручном запуске |
| `docker_ubuntu_codename` | — | кодовое имя релиза для apt-репозитория Docker; по умолчанию берётся с хоста (`ansible_distribution_release`) |
| `docker_apt_arch` | — | `amd64`, либо `arm64` на `aarch64`-хостах |
| `nginx_site_name` | — | `{{ project_user }}` |

`project_user` / `project_group` / `domain` **не имеют дефолтов в плейбуке** — на них стоит `assert`. Предпочтительный путь запуска — `./run.sh`.

## 🔧 Что делает `prod-routine.yml` (по шагам)

1. **Проверки** (`pre_tasks`): заданы `project_user` / `project_group` / `domain`; локально есть `nginx.conf` и `keys/<user>.pub`; ключ валидного формата и ровно в одну строку.
2. **Базовые пакеты**: `curl`, `software-properties-common`, `ca-certificates`, `apt-transport-https`, `gnupg`, `lsb-release`, `wget`.
3. **nginx**: установка + `enable`/`start`.
4. **certbot**: `certbot` + `python3-certbot-nginx`.
5. **Docker**: GPG-ключ в `/etc/apt/keyrings/docker.gpg` + apt-репозиторий → `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, `docker-compose-plugin`; группа `docker`; проверка `docker compose version`.
6. **Deploy-пользователь**: `project_user` (shell `/bin/bash`, свой дом, состоит в `docker`).
7. **Кеш-каталог nginx**: `/var/cache/nginx/frontend` (зона `frontend_cache` — единственная в шаблоне).
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

Кодовое имя релиза для apt-репозитория Docker берётся **с самого хоста** (`ansible_distribution_release`), а не прибито константой. Жёсткий `jammy` на сервере с другой Ubuntu (например 25.10 «resolute») ставит пакеты для 22.04 и конфликтует с системными.

Если Docker ещё не опубликовал пакеты под свежий релиз — переопределите вручную ближайшим LTS:

```bash
ansible-playbook playbooks/prod-routine.yml -i inventory/hosts.ini \
  -e "docker_ubuntu_codename=noble ..."
```

Список опубликованных релизов: <https://download.docker.com/linux/ubuntu/dists/>.

## 🌐 `templates/nginx.conf` — reverse-proxy

Один upstream:

| Upstream | Порт | Назначение |
|---|---|---|
| `frontend` | 3000 | Next.js |

Зона кеша `frontend_cache` (статика `/_next/static` и файлы по расширениям), заголовок `X-Cache-Status`, редирект `www → apex`, `/health` отдаётся самим nginx.

### ⚠️ Отдельная локация `/api/stream` — не украшение

SSE-поток оповещений вынесен в свою локацию ровно из-за буферизации: с дефолтным `proxy_buffering` nginx копит ответ и отдаёт события пачками с задержкой в десятки секунд — лента выглядит «залипшей», хотя приложение работает. Плюс `proxy_read_timeout 24h`: между событиями GCN может молчать часами, пинг раз в 15 с лишь удерживает соединение, рвать его по таймауту нельзя.

При правке шаблона эту локацию нельзя схлопывать с `location /`.

> ⚠️ `server_name` собираются из `domain`, править шаблон руками не нужно.

> ⚠️ **В шаблоне нет ни одной директивы `listen`** — ни для 80, ни для 443. nginx в этом случае слушает `*:80` по умолчанию, а `listen 443 ssl` и пути к сертификатам дописывает certbot при выпуске. До прогона certbot редирект `www → https://apex` ведёт на ещё не работающий https — это нормально, поправится после выпуска сертификата.

## 🔒 TLS (certbot)

Плейбук ставит certbot, но **сертификаты не выпускает** — нужен уже указывающий на сервер DNS. После прогона и настройки DNS выпустите вручную:

```bash
ssh <user>@<server>
sudo certbot --nginx -d gcn.testing-nasa-notifications.com
```

`www.` в списке нет намеренно — см. раздел про домен выше.

certbot сам пропишет `listen 443 ssl`, пути к сертификатам и настроит автопродление.

## 🔗 Связь с CI/CD

| Что создаёт плейбук | Как использует CI (`deploy_production`) |
|---|---|
| `project_user` + SSH-ключ | заходит по SSH как `SSH_USER` (= `project_user`) |
| `/var/www/<project_user>` | каталог деплоя: туда копируются compose + `.env` и запускается `docker compose up` |
| Docker + группа `docker` | `docker compose pull/up` без sudo |
| системный nginx | проксирует контейнер frontend (`127.0.0.1:3000`) наружу |

### `project_dir` и каталог деплоя в CI — это один и тот же путь

Обе стороны **выводят** его по одному правилу, руками путь нигде не вводится:

| | Откуда берётся | Что делает |
|---|---|---|
| `project_dir` (Ansible) | `/var/www/{{ project_user }}` — дефолт в плейбуке | **создаёт** каталог, владелец `project_user:project_group` |
| `REMOTE_DIR` (CI) | `/var/www/$SSH_USER` — вычисляется в шаге деплоя workflow | **копирует** туда compose и env-файлы, запускает `docker compose up` |

⚠️ **Единственное, что должно совпадать вручную, — имя пользователя:**

```
project_user (ответ в run.sh)  ==  SSH_USER (секрет GitHub Actions)
```

Пути после этого сходятся сами. Разойдётся пользователь — разойдутся и каталоги: Ansible создаст `/var/www/<project_user>`, CI пойдёт в `/var/www/<SSH_USER>`, прав на запись там не окажется, деплой упадёт.

Меняете префикс в `REMOTE_DIR` в [deploy.yml](../.github/workflows/deploy.yml) — передайте плейбуку тот же: `-e "project_dir=<префикс>/<project_user>"`.

Подробности со стороны CI — в [08-ci-cd.md](./08-ci-cd.md#3-деплой).

## ♻️ Идемпотентность

`prod-routine.yml` можно **прогонять повторно** — задачи идемпотентны (apt-состояния, `creates:` для docker-ключа, `state: present/link`). Повторный запуск безопасно доводит сервер до нужного состояния, например после правки `nginx.conf`.

## 🔗 Связанные документы

- [CI/CD — сборка и деплой](./08-ci-cd.md)
- [Docker Compose](./04-docker-compose.md)
- [Переменные окружения](./03-environment-variables.md)
