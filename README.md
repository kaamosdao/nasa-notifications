# NASA / GCN Notifications

A site that shows the stream of scientific alerts from
[GCN (General Coordinates Network, NASA)](https://gcn.nasa.gov/) in real time: gravitational
waves, gamma-ray bursts, fast radio bursts, neutrino events and circulars.

Two scenes on one page: a full-screen WebGL hero (a water-like metaball drop against a
procedural night sky — physically sampled star field, interstellar dust and nebulae) and an
alert feed that behaves like a messenger: new events arrive from the bottom, history loads
at the top.

The target architecture, decisions taken and work stages live in the
[project plan](./docs/15-plan.md). That document is the source of truth; the topic-specific
docs are brought in line with it as implementation proceeds.

## 🏗 Architecture

```
GCN (Kafka/SASL) → ingestor (Node) → Postgres → SSE → browser
```

Three services in `docker-compose`: `ingestor` (Kafka consumer, parsing and normalisation),
`frontend` (Next.js: feed SSR, SSE stream, API) and `postgres` (event history).

## 🚀 Quick start

1. Copy `.env.sample` to `.env` and fill in the values
   (see [03-environment-variables.md](./docs/03-environment-variables.md)).
2. Bring the stack up:
   ```bash
   docker compose up -d
   ```
3. Open http://localhost:3000

GCN credentials (`GCN_CLIENT_ID` / `GCN_CLIENT_SECRET`) are issued at
[gcn.nasa.gov](https://gcn.nasa.gov/) and live on the server only — never in `NEXT_PUBLIC_*`.

## 📚 Documentation

Docs are written in Russian.

- [Project structure and FSD architecture](./docs/01-project-structure.md)
- [Project packages and Biome](./docs/02-packages-and-biome.md)
- [Environment variables](./docs/03-environment-variables.md)
- [Running via Docker Compose](./docs/04-docker-compose.md)

Full table of contents — [README in docs/](./docs/README.md).

## 🛠️ Tech stack

- **Next.js 15** (Pages Router) — feed SSR, API routes, SSE
- **TypeScript 5.9** — typing
- **PostgreSQL 16** — alert history, `LISTEN/NOTIFY` as the realtime bridge
- **gcn-kafka** — GCN stream consumer
- **WebGL2** — hero scene (raymarching, no third-party 3D libraries)
- **Feature-Sliced Design** — frontend architecture
- **Biome** — linter and formatter
- **Docker Compose** — local development and deployment

## 🌐 Interface language

The UI is in English. Source comments and `docs/` stay in Russian — they are the working
language of the team, not part of the product.
