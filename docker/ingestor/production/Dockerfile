# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Реестр npm — единый параметр сборки (в CI приходит из input npm_registry компонента).
ARG NPM_REGISTRY=https://registry.npmjs.org
ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY}
RUN apk add --no-cache libc6-compat tini
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate
WORKDIR /app
RUN echo "registry=${NPM_REGISTRY}" > .npmrc

# Зависимости только для пакета ingestor (кешируемый слой)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/ingestor/package.json ./services/ingestor/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter ingestor...

# Компиляция TypeScript в dist/
FROM deps AS builder
COPY services/ingestor ./services/ingestor
RUN pnpm --filter ingestor build

# Рантайм: pnpm не нужен, стартуем node напрямую
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=deps /app/services/ingestor/node_modules ./services/ingestor/node_modules
COPY --chown=node:node --from=builder /app/services/ingestor/dist ./services/ingestor/dist
COPY --chown=node:node services/ingestor/sql ./services/ingestor/sql
COPY --chown=node:node services/ingestor/package.json ./services/ingestor/

USER node

CMD ["tini", "--", "node", "services/ingestor/dist/index.js"]
