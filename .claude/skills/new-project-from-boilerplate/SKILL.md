---
name: new-project-from-boilerplate
description: >-
  Spins up a new project from this boilerplate (Next.js + Strapi): renames the
  project, sets the domains, generates env secrets, and prepares the repository for a new
  engagement. Use ALWAYS when the user starts a new project/site from this template,
  says "I cloned the boilerplate", "rename it for <client>", "set up the environment for a
  new project", "change the domains", "generate Strapi keys" — even if the word
  "boilerplate" isn't spoken but the context is clearly a first-time initialization from the template.
---

# New project from boilerplate

This template is originally named `rebootme` (npm) with the slug `boilerplate` and domains
`*.boilerplate.snpdev.ru`. Before the project becomes "your own", you need to strip out these
hardcoded values, generate fresh secrets, and prepare the env files. Order matters:
`PROJECT_SLUG` sets the prefix for the docker containers/volumes/network, so it must be
locked in **before the first `docker compose up`**, otherwise the old volumes detach and the DB
will appear empty.

Full detail on each point is in `docs/`: env — `docs/03-environment-variables.md`,
slug/compose — `docs/04-docker-compose.md`, domains/CI — `docs/08-ci-cd.md`,
ansible — `docs/10-ansible-playbook.md`.

## Step 1. Gather the project parameters

First ask the user (or confirm, if already stated):
- **slug** — a short project name in Latin letters, `[a-z0-9-]` (becomes `PROJECT_SLUG` and the npm package name);
- **domains** — frontend / admin / imgproxy / search for the testing stand (`*.snpdev.ru`) and,
  separately, the production domains (they don't have to match testing);
- **deploy user** for the production server (ansible `project_user`).

## Step 2. Rename the hardcoded values

Go through these spots (all verified — this is the complete list of "boilerplate leftovers"):

| What to change | File | Current |
|---|---|---|
| npm package name | `package.json` → `"name"` | `rebootme` |
| Slug for containers/volumes/network | `.env`, `.env.example`, `.env.sample` → `PROJECT_SLUG` | `boilerplate` |
| Testing domains (VIRTUAL_HOST) | `.gitlab-ci.yml` → `domain_frontend/backend/imgproxy/meili` | `*.boilerplate.snpdev.ru` |
| Production domains / project vars | `ansible/run.sh` prompts (or `-e`) | `domain`, `project_*` |
| Production server host | `ansible/run.sh` prompts / `inventory/hosts.ini` example | IP |
| Deploy key | `ansible/keys/<user>.pub` (replace, delete the old one) | `sozdateli.pub` |

Domains live in **two unrelated places**: testing is routed through `nginx-proxy`
by `VIRTUAL_HOST` from `.gitlab-ci.yml`, and production through the system nginx by `domain`
from `ansible/run.sh` (passed as `-e`). Change both.

## Step 3. Create the env files

Environment files are not in git (`.env*` is ignored, except `.env.sample`) — create them by hand.

**Root `.env`** (frontend + docker) — from `.env.example`. Required:
`PROJECT_SLUG`, `ENVIRONMENT`, `NEXT_PUBLIC_STRAPI_URL`,
`NEXT_PUBLIC_NETWORK_STRAPI_URL` (= `http://backend:1337` for the docker network),
`NEXT_PUBLIC_STRAPI_API_TOKEN`, `IMGPROXY_KEY`, `IMGPROXY_SALT`.

**`@strapi/.env`** (backend) — from `@strapi/.env.example`. Required:
`APP_KEYS` (4 comma-separated values), `ADMIN_JWT_SECRET`, `API_TOKEN_SALT`,
`TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY`, the `DATABASE_*` block, `POSTGRES_USER/PASSWORD/DB`.

Generating secrets (recipes in `docs/03-environment-variables.md`):
```bash
openssl rand -base64 32      # APP_KEYS (make 4), JWT/salts
openssl rand -hex 32         # ENCRYPTION_KEY, IMGPROXY_KEY/SALT
```

`DATABASE_HOST` depends on the mode: `postgres` (the service name) for docker, `localhost`
for local `pnpm develop`. Note: `docker-compose.yml` forces
`DATABASE_HOST: postgres` via `environment` anyway, overriding `env_file`.

## Step 4. Secret hygiene

- **Do not copy** a live `.env` from an old project — it holds someone else's tokens (GitLab PAT,
  Figma, Strapi). Generate new ones.
- Remove the committed key `ansible/keys/sozdateli.pub`, drop in your own `keys/<user>.pub`.
- `scripts/gitlab_vars.conf` (the GitLab token) is created separately and is not committed to git —
  that's already CI configuration, see the `ci-deploy` skill.

## Step 5. Verification

After renaming, run a search for leftovers — there should be no matches, except for
historical mentions in `docs/`:
```bash
grep -rn --exclude-dir=node_modules --exclude-dir=.git \
  -e 'rebootme' -e 'boilerplate.snpdev' -e 'familydom' .
```
Then make sure the local run comes up — hand off to the `local-run` skill.
