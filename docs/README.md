# Документация проекта

Документация проекта **NASA / GCN Notifications** — лента научных оповещений GCN в реальном
времени на Next.js (Feature-Sliced Design).

⚠️ Проект вырос из студийного boilerplate с Strapi. Документы 03, 04, 08, 10 и 13 частично
описывают ту, прежнюю конфигурацию и будут переписаны на этапе 5 (деплой и полировка).
Источник правды по архитектуре — [план проекта](./15-plan.md).

## 📚 Содержание

1. **[Структура проекта и FSD архитектура](./01-project-structure.md)**
   - Обзор архитектуры Feature-Sliced Design
   - Описание всех слоев (app, processes, pages, widgets, features, entities, shared, _pages)
   - Правила импорта между слоями
   - Алиасы путей
   - Структура слайсов (api/, model/, ui/)
   - Примеры использования

2. **[Пакеты проекта и Biome](./02-packages-and-biome.md)**
   - Обзор основных зависимостей
   - Детальная настройка Biome (линтер и форматтер)
   - Конфигурация правил линтера
   - Организация импортов
   - Примеры использования команд
   - Краткий обзор других ключевых пакетов

3. **[Переменные окружения](./03-environment-variables.md)**
   - Frontend переменные (.env)
   - Docker переменные
   - Переменные Postgres и GCN
   - Примеры конфигурации для development и production
   - Генерация ключей для безопасности
   - Решение проблем

4. **[Запуск проекта через Docker Compose](./04-docker-compose.md)**
   - Требования и установка
   - Архитектура сервисов
   - Настройка переменных окружения
   - Пошаговая инструкция запуска
   - Полезные команды
   - Работа с volumes
   - Решение проблем

5. **[CI/CD — сборка и деплой через GitLab](./08-ci-cd.md)**
   - Подключение переиспользуемого CI/CD-компонента и его параметры
   - Стадии prepare → build → deploy
   - Ветки → окружения → версии образов (testing/staging/release)
   - Реестр образов, версионирование тегов
   - Шаблоны env (`ci/env/*.env.tpl`), npm-реестр (npmjs / зеркало GitVerse)
   - Healthcheck и порядок запуска контейнеров
   - Отладка и частые ошибки

6. **[Скрипты — менеджер CI/CD-переменных GitLab](./09-gitlab-vars-script.md)**
   - `scripts/gitlab_copy_env.sh` — копирование и загрузка CI-переменных
   - Конфигурация `gitlab_vars.conf`
   - Режим 1: копирование между environment'ами
   - Режим 2: загрузка из `.env`-файлов
   - Логика создания/обновления переменных и откаты
   - Замечания по безопасности

7. **[Ansible — подготовка прод-сервера](./10-ansible-playbook.md)**
    - `run.sh` — интерактивное меню: setup прод-сервера
    - `prod-routine.yml` — Docker, nginx (reverse-proxy), certbot, deploy-пользователь
    - Переменные (`project_user`, `project_group`, `domain`) и запуск
    - `templates/nginx.conf`, TLS через certbot (в шаблоне нет `listen` — их дописывает certbot)
    - Связь с CI (`deploy_production`), идемпотентность

8. **[Формирование sitemap.xml](./12-sitemap.md)**
    - Почему нельзя генерировать из файловой системы (`%5Bslug%5D`, нет динамики)
    - Обход `src/pages`: статические маршруты (динамических публичных URL в проекте нет)
    - XML-экранирование, `Cache-Control` на сутки
    - Референс-реализация и проверка

9. **[Подводные камни проекта (footguns)](./13-gotchas.md)**
    - Единый список неочевидных ловушек по областям
    - Окружение/сборка, архитектура фронта, Strapi/данные, Docker/деплой
    - `NEXT_PUBLIC_*` build-time, кириллица в путях, `up -d` не `restart`, РФ-зеркала
    - Ссылки на профильные скиллы за деталями

10. **[SEO — договорённости и текущая реализация](./14-seo.md)**
    - Главный принцип: SEO не собирается вручную, цепочка fallback
    - `SeoLayout` + `mergeSeoData`: meta/OG/Twitter/canonical/robots
    - Типы SEO-слоя (`shared/types/seo.ts`), env-гейт индексации (только прод)
    - Подключение SEO новому типу страницы в 3 шага
    - Договорённости студии (title/canonical/OG/schema.org/каталог/мультиязычность) + чеклист QA

11. **[План проекта: NASA / GCN Notifications](./15-plan.md)** ⭐
    - Что делаем: hero с WebGL-metaballs + лента оповещений GCN в реальном времени
    - Принятые архитектурные решения и почему именно так
    - Архитектура: `ingestor` (gcn-kafka) → Postgres → SSE → браузер
    - Схема БД, парсеры топиков, API-роуты
    - Поведение ленты (мессенджер), шейдер metaballs, переход intro → background
    - Этапы 0–6 с критериями проверки, переменные окружения, риски

## 🚀 Быстрый старт

1. **Прочитайте [план проекта](./15-plan.md)** — он описывает целевую архитектуру
2. **Настройте переменные окружения** (см. [03-environment-variables.md](./03-environment-variables.md))
3. **Запустите проект через Docker Compose** (см. [04-docker-compose.md](./04-docker-compose.md))
4. **Изучите структуру проекта** (см. [01-project-structure.md](./01-project-structure.md))
5. **Настройте Biome** (см. [02-packages-and-biome.md](./02-packages-and-biome.md))

## 📖 Дополнительная информация

- Основной README проекта находится в корне: [../README.md](../README.md)

## 🔗 Полезные ссылки

- [Feature-Sliced Design](https://feature-sliced.design/)
- [Next.js документация](https://nextjs.org/docs)
- [GCN (General Coordinates Network)](https://gcn.nasa.gov/)
- [GCN Kafka / схемы сообщений](https://gcn.nasa.gov/docs/schema)
- [Biome документация](https://biomejs.dev/)
- [Docker Compose документация](https://docs.docker.com/compose/)
