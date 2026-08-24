---
name: local-run
description: >-
  Brings the project up locally (Next.js frontend + Strapi backend + postgres/imgproxy/meilisearch):
  either natively via pnpm, or through Docker Compose. Use ALWAYS when the user
  asks to "run it locally", "bring up the stack", "build the frontend", "docker compose up", "start
  Strapi/the backend", "why won't the container start", "rebuild the image", "back up the DB" —
  and generally for any local build, run, or debugging of this project's dev environment.
---

# Local build and run

Node from `.nvmrc` = `v22.17.0`, package manager — pnpm 11.0.8. The frontend lives at the root,
the backend in `@strapi/`; there are no workspace packages, they are installed independently. Details —
`docs/04-docker-compose.md`.

There are two paths: **native** (fast hot-reload, convenient for coding) and **Docker Compose**
(closer to production, brings up the whole infrastructure). Choose based on the task.

## Option A. Native (pnpm)

For the backend, `DATABASE_HOST` in `@strapi/.env` must be `localhost` (not `postgres`).

```bash
# DB in docker (postgres only), if you have no local PG:
docker compose up -d postgres

# backend — terminal 1
cd @strapi && pnpm install && pnpm develop      # http://localhost:1337/admin

# frontend — terminal 2, from the root
pnpm install && pnpm dev                         # http://localhost:3000
```

Frontend scripts (`package.json`): `pnpm dev`, `pnpm build`, `pnpm start`,
`pnpm lint` (biome check), `pnpm format`, `pnpm check` (biome check --write).

## Option B. Docker Compose (dev)

`docker-compose.yml` — dev mode: **builds the images locally** and mounts the code for
hot-reload. The Dockerfile path is chosen by `ENVIRONMENT` (`docker/*/${ENVIRONMENT}/Dockerfile`).

```bash
export PROJECT_SLUG=<slug> ENVIRONMENT=development   # or set them in the root .env
docker compose up -d
docker compose ps
docker compose logs -f backend
```

Ports: frontend **3000**, Strapi **1337** (`/admin`), postgres **5432**,
imgproxy **8080**, meilisearch **7700**.

Startup order in dev is a plain `depends_on` without a healthcheck: postgres → backend → frontend/imgproxy.

## Useful commands

```bash
docker compose build --no-cache backend          # rebuild a single service
docker compose down                              # stop (data is preserved)
docker compose down -v                           # ⚠️ tear down ALONG WITH the volume (deletes the DB)
docker compose exec postgres pg_dump -U strapi strapi > backup.sql   # DB backup
```

## Pitfalls

1. **Changing `ENVIRONMENT` requires a rebuild** — the Dockerfile path is baked into the environment name;
   without `docker compose build` the old image stays.
2. **`docker-compose.testing.yml` / `.production.yml` won't come up "as is" locally** —
   they don't build but pull ready-made images `${CI_REGISTRY_IMAGE}/<svc>:${VERSION_TAG}` and expect
   `<svc>.env` files alongside + the `CI_REGISTRY_IMAGE`/`VERSION_TAG` variables that CI writes.
   For local use only `docker-compose.yml`.
3. **External images are pulled from the mirror** `dockerhub.timeweb.cloud/*` (not Docker Hub) —
   outside the work environment they may not be pullable.
4. **`NEXT_PUBLIC_*` are baked in at the `next build` step**, not at runtime — in prod mode
   editing `.env` without rebuilding the frontend image won't be picked up (in dev with hot-reload it's fine).
5. **`down -v` deletes the DB.** If you need to keep the data — take a backup beforehand.

To debug "the container won't start", check the logs (`docker compose logs <svc>`) and the typical
causes in `docs/08-ci-cd.md` (unhealthy backend — Strapi didn't come up in time, raise `start_period`;
SyntaxError on Strapi startup — see the `docker-images` skill).
