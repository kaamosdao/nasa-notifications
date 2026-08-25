---
name: local-run
description: >-
  Brings the project up locally (Next.js frontend + postgres, later the ingestor worker):
  either natively via pnpm, or through Docker Compose. Use ALWAYS when the user
  asks to "run it locally", "bring up the stack", "build the frontend", "docker compose up",
  "start the ingestor", "why won't the container start", "rebuild the image", "back up the DB" —
  and generally for any local build, run, or debugging of this project's dev environment.
---

# Local build and run

Node from `.nvmrc` = `v22.17.0`, package manager — pnpm. The frontend lives at the root;
the Kafka consumer lives in `services/ingestor` as a pnpm-workspace package.
Details — `docs/04-docker-compose.md`.

There are two paths: **native** (fast hot-reload, convenient for coding) and **Docker Compose**
(closer to production, brings up the whole infrastructure). Choose based on the task.

## Option A. Native (pnpm)

```bash
# DB in docker (postgres only), if you have no local PG:
docker compose up -d postgres

# frontend, from the root
pnpm install && pnpm dev                         # http://localhost:3000

# Kafka consumer (applies the SQL migrations from services/ingestor/sql on startup)
pnpm ingestor:dev
```

In `.env`, `DATABASE_URL` must point at `localhost` (not `postgres`) — the service name only
resolves inside the compose network.

Frontend scripts (`package.json`): `pnpm dev`, `pnpm build`, `pnpm start`,
`pnpm lint` (biome check), `pnpm format`, `pnpm check` (biome check --write).

## Option B. Docker Compose (dev)

`docker-compose.yml` — dev mode: **builds the images locally** and mounts the code for
hot-reload. The Dockerfile path is chosen by `ENVIRONMENT` (`docker/*/${ENVIRONMENT}/Dockerfile`).

```bash
export PROJECT_SLUG=<slug> ENVIRONMENT=development   # or set them in the root .env
docker compose up -d
docker compose ps
docker compose logs -f frontend
```

Ports: frontend **3000**, postgres **5432**.

Postgres has a healthcheck (`pg_isready`); the frontend waits for `service_healthy` — an app
that starts before the DB accepts connections fails its first SSR query, not at some later
point where the cause would be obvious.

## The GCN stream in dev

GCN can stay silent for hours, so an empty feed is **not** evidence that something is broken.
For anything animation- or layout-related, drive the feed from the mock producer instead of
waiting on the real stream — it runs the same parsers and writes the same rows, no Kafka needed:

```bash
pnpm --filter ingestor seed          # one batch of three formats (gw / circular / classic text)
pnpm --filter ingestor seed --loop   # one event every 2 seconds
```

Checking the API by hand:

```bash
curl -s 'localhost:3000/api/notices?limit=5'   # history, cursor pagination
curl -N  localhost:3000/api/stream             # live SSE (":ping" every 15 s)
curl -s  localhost:3000/api/health             # ingestor heartbeat + lag
```

With `seed --loop` running, open http://localhost:3000 — cards should arrive at the bottom every
2 s, the feed should stay pinned to the bottom, and scrolling up should turn new arrivals into the
"↓ N new" pill instead of yanking the view.

The hero canvas is mounted in `_app`, so it renders on every page and does **not** need the DB —
an empty feed still shows the metaball over the starfield. If it stays black, check the console for
`hero: …` (context/compile/link failures throw from `HeroRenderer` and fall back to the poster).
The canvas pauses its rAF loop when the tab is hidden — a background tab measuring 0 FPS is correct,
not a hang.

The page opens on the intro phase: the feed is present in the DOM but hidden (`visibility: hidden`
+ `inert`) until "Открыть поток" is pressed. `Esc` or "↑ К началу" in the header goes back. If the
feed looks missing, check the phase before suspecting the DB.

`/api/health` answers `status: "unknown"` while only the seed producer has run — the seed
writes rows but no heartbeat; `service_state` is touched by the real worker only.

`GCN_CLIENT_ID` / `GCN_CLIENT_SECRET` must be a live pair from gcn.nasa.gov — a revoked one
fails at startup with `invalid_client` from the broker, before any topic is subscribed.

## Useful commands

```bash
docker compose build --no-cache frontend         # rebuild a single service
docker compose down                              # stop (data is preserved)
docker compose down -v                           # ⚠️ tear down ALONG WITH the volume (deletes the DB)
docker compose exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
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
6. **Two ingestor instances double-consume.** The consumer keeps a stable `groupId`; running the
   worker natively while the compose one is up makes both rebalance against each other. Run one.

To debug "the container won't start", check the logs (`docker compose logs <svc>`) and the typical
causes in `docs/08-ci-cd.md`.
