# syntax=docker/dockerfile:1.6
# База с corepack/pnpm
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Реестр npm — единый параметр сборки. Дефолт: npmjs.
# Включить РФ-зеркало: --build-arg NPM_REGISTRY=https://npm-mirror.gitverse.ru
# (в CI прокидывается из input npm_registry компонента).
#   COREPACK_NPM_REGISTRY — corepack скачивает сам pnpm через эту переменную.
#   .npmrc ниже задаёт реестр для `pnpm install` (генерится из того же ARG).
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY}
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate
WORKDIR /app
RUN echo "registry=${NPM_REGISTRY}" > .npmrc

# Отдельный слой для зависимостей (кешируемый)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Манифест ingestor'а нужен для --frozen-lockfile, но сами его зависимости
# в образ фронта не ставим — отсюда фильтр по корневому пакету.
COPY services/ingestor/package.json ./services/ingestor/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter nasa-notifications

# Сборка Next
FROM base AS builder
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Загружаем переменные окружения из секрета для сборки Next.js
RUN --mount=type=secret,id=frontend_env \
  export $(grep -v '^[#[:space:]]' /run/secrets/frontend_env | xargs) && \
  pnpm build
#RUN pnpm build-storybook

# Обрезаем до production-зависимостей.
# Не `pnpm prune --prod`: он не принимает --filter, работает по всему workspace
# и пересоздаёт node_modules, а без TTY это подтверждение обрывает сборку
# (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY). CI=true снимает вопрос.
# rm -rf обязателен: поверх готового node_modules `install --prod` убирает только
# ссылки верхнего уровня, а сами dev-пакеты остаются в node_modules/.pnpm и едут в образ.
FROM deps AS pruner
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  rm -rf node_modules && \
  CI=true pnpm install --prod --frozen-lockfile --filter nasa-notifications

# Легкий рантайм-образ
# pnpm/corepack здесь не нужны — старт идёт напрямую через node (см. CMD).
FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache tini libc6-compat msmtp

# msmtp как sendmail (/usr/local/bin уже в PATH в node:alpine)
RUN ln -sf /usr/bin/msmtp /usr/local/bin/sendmail

WORKDIR /app

# Копируем только то, что нужно на рантайме (всё уже с владельцем node,
# поэтому отдельный `chown -R` не нужен — он бы продублировал node_modules в новый слой)
COPY --chown=node:node --from=pruner /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/.next ./.next
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/src ./src
COPY --chown=node:node --from=builder /app/next.config.js ./
COPY --chown=node:node package.json ./

EXPOSE 3000

USER node

# Запуск через tini для корректной обработки сигналов
# CMD ["tini", "--", "pnpm", "start"]
CMD ["tini", "--", "node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
