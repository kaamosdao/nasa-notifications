---
name: docker-images
description: >-
  Builds and publishes this project's frontend/backend Docker images: multi-stage
  Dockerfiles, build-args, BuildKit secrets, switching the npm registry to the RU mirror
  (npm-mirror.gitverse.ru). Use ALWAYS when the user asks to "build the image",
  "docker build the frontend/backend", "why does the image build fail", "switch npm to the mirror",
  "set up the Dockerfile", "Strapi crashes with SyntaxError on startup", "the image won't build
  because of sharp/vips" — and for any manual build or debugging of production images.
---

# Docker images

The images are multi-stage; the npm registry is parameterized through a single build-arg
`NPM_REGISTRY` (default `https://registry.npmjs.org`; the RU mirror
`https://npm-mirror.gitverse.ru` is enabled explicitly). Build secrets are passed via
**BuildKit `--secret`**, not COPY/ARG. Details — `docs/08-ci-cd.md` (the images section).

Dockerfiles: `docker/frontend/{development,production}/Dockerfile`,
`docker/backend/{development,production}/Dockerfile`.

## How the npm registry is applied (this is non-obvious)

The registry is set in **two places, in different ways**, because pnpm itself is downloaded BEFORE
`.npmrc` exists:
- **frontend**: pnpm is installed via corepack → `ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY}`;
- **backend**: pnpm is installed via `npm i -g` → `ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}`;
- in both, `.npmrc` is generated from the ARG (`RUN echo "registry=${NPM_REGISTRY}" > .npmrc`) — that's
  already for `pnpm install`.

So changing only `.npmrc` will **not** switch the download of pnpm itself. If you change the registry —
change the build-arg, it distributes it to all three places.

## Manual build

The production stages read the env via a BuildKit secret, so the build **must** use
`--secret`, otherwise the `pnpm build` step fails:

```bash
# frontend (context = root)
docker buildx build \
  --build-arg NPM_REGISTRY=https://npm-mirror.gitverse.ru \
  --secret id=frontend_env,src=./frontend.env \
  -f docker/frontend/production/Dockerfile \
  -t <registry>/frontend:<tag> .

# backend (context = ./@strapi)
docker buildx build \
  --build-arg NPM_REGISTRY=https://npm-mirror.gitverse.ru \
  --secret id=backend_env,src=./backend.env \
  -f docker/backend/production/Dockerfile \
  -t <registry>/backend:<tag> ./@strapi
```

`frontend.env` / `backend.env` — the same files that CI generates from `ci/env/*.env.tpl`.
The committed `.npmrc` in the repo is only for local `pnpm install`; the image build does not
use it.

## Stage structure (in brief)

- **frontend/production**: `base → deps → builder → pruner → runner`. `base` = `node:22-alpine`
  + corepack + `pnpm@11.0.8`. `builder` reads `/run/secrets/frontend_env` and does `pnpm build`.
  `runner` runs under `USER node`, start: `next start -p 3000` via `tini`.
- **backend/production**: `base → builder → pruner → runner`. In `builder` — the native dependencies
  `python3 make g++ pkgconfig vips-dev` (for sharp/node-gyp), `pnpm build` builds the admin panel.
  `runner` = `node:22-alpine` + `vips tini`, `NODE_ENV=production`, start `strapi.js start`.
- **development** variants — single-layer, the code is mounted via compose (see the `local-run` skill).

## Pitfalls

1. **The Strapi entrypoint is real JS**: `node_modules/@strapi/strapi/bin/strapi.js`,
   NOT `node_modules/.bin/strapi` (that's an sh-shim → `node` crashes with `SyntaxError`).
   This is the most common cause of "Strapi crashes on startup".
2. **The backend runtime must have `NODE_ENV=production`** — otherwise Strapi starts in dev mode
   on top of a production build of the admin panel.
3. **Without `--secret` the production build fails** at the `pnpm build` step (it needs the env variables
   from the secret). You need `# syntax=docker/dockerfile:1.6` and buildx.
4. **Native module errors** (`sharp`, node-gyp) during the backend build — make sure the `builder`
   stage installs `vips-dev python3 make g++`; at runtime `vips` is enough.
5. **The dev-compose does not pass `NPM_REGISTRY`** — the default npmjs is used. In CI the mirror
   comes from the `npm_registry` input. If a dev build can't pull packages due to blocks —
   add the build-arg manually.

Tag publishing and branch binding (`IMAGE_TAG`/`VERSION_TAG`, registry) — in the `ci-deploy` skill.
