---
name: ci-deploy
description: >-
  Configures and runs this project's CI/CD and deployment: GitLab variables via
  scripts/gitlab_copy_env.sh, the pipeline from ci-components (prepare→build→deploy),
  the testing/staging/release branches, and production deployment (SSH + docker compose) with server
  initialization via Ansible. Use ALWAYS when the user says "set up CI",
  "push the variables to GitLab", "deploy to testing/staging/prod", "why did the pipeline fail",
  "copy env between environments", "run the ansible playbook", "prepare the server" —
  and for any work with GitLab CI, gitlab_vars, or deployment of this project.
---

# CI/CD and deployment

The pipeline is a thin `include` of the component `saltpepper/ci-components/pipeline@1.0.9`
(`.gitlab-ci.yml`). Stages: **prepare → build → deploy**. Image registry —
`registry.git.snpdev.ru`. Full details — `docs/08-ci-cd.md`, the variables script —
`docs/09-gitlab-vars-script.md`, ansible — `docs/10-ansible-playbook.md`.

## How the pipeline works

Inputs in `.gitlab-ci.yml`:
- `services` — a `<svc>.env` is generated for each (only `backend`/`frontend` are built);
- `required_vars` — a fail-fast check in `prepare_env`;
- `npm_registry` — `https://npm-mirror.gitverse.ru` (RU mirror, passed through as a build-arg);
- `domain_*` — written into `VIRTUAL_HOST_*` for testing.

Branch → environment (this is the key deployment table):

| Branch | ENV_NAME | VERSION_TAG | Deploy job |
|---|---|---|---|
| `testing` | testing | testing | `deploy_local` — **auto**, on the runner |
| `staging` | staging | staging | `deploy_production` — **manual**, over SSH |
| `release/*` | production | `release-x-y-z` | `deploy_production` — **manual** |

`IMAGE_TAG` = `<ref-slug>-<short-sha>` (immutable, for rollback);
`VERSION_TAG` = the movable branch tag.

## Step 1. Configuring GitLab variables

Secrets are substituted into the `ci/env/*.env.tpl` templates via `envsubst` during `prepare_env`,
so every `${VAR}` must exist as a CI variable with the correct `environment_scope`.

Manager script: `scripts/gitlab_copy_env.sh` (requires `curl`, `python3`, a PAT with the `api`
scope and a role ≥ Maintainer). The config sits alongside the script — `scripts/gitlab_vars.conf`
(do not commit to git):
```
GITLAB_URL=https://git.snpdev.ru
PROJECT_ID=<id>
TOKEN=<personal-access-token>
ENV_FILES=".env @strapi/.env"
```
Run (interactive menu):
```bash
cd scripts && ./gitlab_copy_env.sh
# 1 = copy variables between environments (source → target env)
# 2 = load from local .env files
```
The script is idempotent: it creates (POST 201) or updates (PUT 200) a variable, preserving
`masked/protected/variable_type`. Mode 2 loads everything as `masked=false, protected=false`.

## Step 2. Running a deploy

- **testing**: `git push` to the `testing` branch → auto prepare→build→deploy_local. Nothing
  to click by hand.
- **staging / prod**: the `staging` or `release/*` branch → the pipeline reaches `deploy_production`
  and **waits for a manual run** of the job in the GitLab UI.

Before bumping the component version, run the linter: `glab ci lint`.

## Step 3. Production server (first-time initialization — Ansible)

The production server is prepared once via Ansible (creates `project_user`, installs docker,
the system nginx, lays out `/var/www/<user>`):
```bash
cd ansible
./run.sh
# prompts for domain / project_* / hosts, then runs the playbook
```
`project_user`/`project_group`/`domain` are passed via `./run.sh` (`-e`) — the playbook `assert`s them at the start and
checks for the presence of `ansible/keys/<project_user>.pub` and `ansible/templates/nginx.conf`.
After that, on deploy, CI connects over SSH as `SSH_USER` (= ansible `project_user`),
`scp`s the compose + `.env`, and runs:
`docker compose -f docker-compose.production.yml pull && up -d`.
Production routing/TLS — the system nginx (not the nginx-proxy from testing).

## Pitfalls

1. **A variable's `environment_scope` must match the pipeline's `ENV_NAME`**
   (`testing`/`staging`/`production`/`*`), otherwise `envsubst` substitutes an empty value and the build/start fails.
2. **Keep files with secrets out of git**: `gitlab_vars.conf` (the token) is already ignored
   (`/scripts/*.conf`), but the `gitlab_vars_<env>.json` dumps contain values in plaintext
   and are **not** ignored — delete them after copying.
3. **Pin the component version** `@1.0.9` explicitly — otherwise an update "lands" in all projects.
4. **Typical CI failures** (`docs/08-ci-cd.md`): `denied` on push — role < Developer /
   read-only token; `ERR_PNPM_IGNORED_BUILDS` — add the package to `allowBuilds` in
   `pnpm-workspace.yaml`; `Unknown dialect` — empty `DATABASE_CLIENT`; `backend is
   unhealthy` — Strapi didn't come up in time, raise `start_period`.
5. **Image building and build-args are handled by the `docker-images` skill** — go there for the details
   of the Dockerfiles and the npm mirror.
