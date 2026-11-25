# Development

- [Requirements](#requirements)
- [Run it locally](#run-it-locally)
- [Checks](#checks)
- [Database migrations](#database-migrations)
- [Without Docker](#without-docker)
- [Adding a step type](#adding-a-step-type)
- [Conventions](#conventions)

## Requirements

- Docker
- [just](https://github.com/casey/just), a command runner (`brew install just`)

Nothing else is installed on your machine.

## Run it locally

```bash
just up
```

This builds the images and starts four services:

| Service | Profile | What it does | Where |
|---|---|---|---|
| `seaweedfs` | always | Image store | internal |
| `backend` | always | The API, restarted when a Python file changes. Applies migrations at start | <http://localhost:8000> |
| `admin` | `admin` | The admin panel on the Vite dev server, with hot reload | <http://localhost:5173/admin/> |
| `participant` | `participant` | Rebuilds the participant app on every change; the backend serves it | `http://localhost:5173/s/…` |

Log in with `researcher` and `local-dev-password`. These and the other values in the compose file are for local use only.

### Commands

| Command | Does |
|---|---|
| `just up` | Build and start everything |
| `just up-admin` | Backend and admin panel only |
| `just up-participant` | Backend and participant app only |
| `just down` | Stop. Data is kept |
| `just reset` | Rebuild every image without cache and start again |
| `just logs backend` | Follow logs; leave out the name for all services |
| `just shell` | Open a shell in the backend; `just shell admin` for another service |
| `just test` | Backend tests; extra arguments go to pytest |
| `just check` | Every check for all three parts |
| `just makemigrations "message"` | Autogenerate an Alembic revision |
| `just migrate` | Apply pending revisions |

`just` on its own lists them.

### How it is laid out

```
docker/
  compose/local.yml               the local stack
  images/local/backend.Dockerfile   Python, uv and the backend's dependencies
  images/local/frontend.Dockerfile  Node and one frontend app's packages
  scripts/local/backend.sh          backend entrypoint: migrate, then run
  scripts/local/participant.sh      rebuilds the participant app when its source changes
justfile                          the commands above
```

Without `just`, the same stack starts with:

```bash
docker compose -f docker/compose/local.yml --profile admin --profile participant up -d --build
```

Things to know:

- Dependencies are installed when the images are built, not when the containers start. After changing `pyproject.toml` or a `package.json`, run `just up` again; it rebuilds what changed.
- The source is mounted into the containers, so you edit files as usual. For the frontends that is `src/`, `index.html` and `vite.config.ts`; a change to another file, such as a `tsconfig`, needs `just up` again.
- The participant app is rebuilt, not hot-reloaded. Refresh the study page after a change.
- The database and the images live in Docker volumes. `just down` keeps them.

### If the build fails with "dns error"

Package downloads during the build need working DNS inside Docker. With Colima, the built-in resolver can time out. Restart it with explicit DNS servers; the setting is remembered:

```bash
colima stop && colima start --dns 1.1.1.1 --dns 8.8.8.8
```

## Checks

All of these must pass before a change is done. With the stack running:

```bash
just check              # everything
just check-backend      # pytest, ruff check, ruff format --check, pyright
just check-admin        # typecheck, lint, build
just check-participant  # typecheck, lint, tests
```

UI changes are also looked at in a browser at phone and laptop widths.

## Database migrations

Every model change ships with an Alembic revision.

```bash
just makemigrations "describe the change"
just migrate
```

Read the generated revision before applying it. Never edit a revision that has been applied anywhere.

## Without Docker

You can also run the parts directly, with [uv](https://docs.astral.sh/uv/) and Node 22 or newer. Start only the image store with `docker compose -f docker/compose/local.yml up -d seaweedfs`, then:

```bash
# backend/
export ADMIN_USERNAME=researcher ADMIN_PASSWORD=local-dev-password
export SECRET_KEY=$(openssl rand -hex 32) COOKIE_SECURE=false
export S3_ENDPOINT_URL=http://127.0.0.1:8333 S3_ACCESS_KEY_ID=dev-access-key S3_SECRET_ACCESS_KEY=dev-secret-key
uv sync && uv run alembic upgrade head
uv run uvicorn app.main:app --reload --no-access-log

# frontend/admin/
npm install && npm run dev

# frontend/participant/
npm install && npm run build
```

To have the backend serve both built frontends, as production does, set `STATIC_DIR` to a folder that contains `admin/` and `participant/` (the two `dist` folders).

## Adding a step type

A step type has five parts. Add all of them in one change.

| # | Part | Where |
|---|---|---|
| 1 | Config schema, added to the `StepConfig` union | `backend/app/schemas/steps.py` |
| 2 | Participant plugin | `frontend/participant/src/plugins/` |
| 3 | Editor card | `frontend/admin/src/editor/` |
| 4 | CSV columns | `backend/app/services/export.py` |
| 5 | Tests for the schema and the export | `backend/tests/` |

If the step records something, add its result model to `backend/app/schemas/results.py` as well. Mark the config's wording fields in `text_fields`, so they stay editable after publishing.

## Conventions

The rules live in [`.agents/rules/`](../.agents/rules/). Read the one that matches the files you touch.

| Rule | Applies to |
|---|---|
| [`architecture.md`](../.agents/rules/architecture.md) | Backend structure, layering, transactions |
| [`python.md`](../.agents/rules/python.md) | All Python |
| [`fastapi.md`](../.agents/rules/fastapi.md) | Routers, schemas, dependencies |
| [`frontend.md`](../.agents/rules/frontend.md) | Both frontends |
| [`privacy.md`](../.agents/rules/privacy.md) | Anything touching participants, logging, exports or deployment |

The privacy rules are hard rules. A change that breaks one is wrong even if every check passes. See [Privacy](privacy.md).

Structural decisions are recorded under [`docs/adr/`](adr/README.md). [`AGENTS.md`](../AGENTS.md) is the short orientation for AI coding agents working in this repository.
