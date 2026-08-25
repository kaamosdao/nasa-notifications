FROM node:22-alpine

RUN apk add --no-cache libc6-compat tini

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate

# CI=true: pnpm не спрашивает подтверждения на очистку node_modules в контейнере без TTY
ENV CI=true

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/ingestor/package.json ./services/ingestor/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter ingestor...

COPY services/ingestor ./services/ingestor

# tini — чтобы SIGTERM доходил до Node и consumer успевал отключиться от группы
CMD ["tini", "--", "pnpm", "--filter", "ingestor", "dev"]
