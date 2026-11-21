# GlanceLab

A small web app for a university neuromarketing study. It shows participants one of several versions of a static ad (only the promo price placement differs) and measures whether they notice, remember and quickly find the price.

- **Admin**: exactly one, credentials from `.env`. A non-technical teammate builds study forms in a Google-Forms-like editor, uploads images, previews, publishes a link and downloads a CSV.
- **Participants**: anonymous, no login, ~30+ people on phones or laptops, English only.

Scope is deliberately small: no multiple admins, no i18n, no analytics charts, no webcam or eye tracking. Do not add them.

## Layout

```
backend/                FastAPI + SQLModel + Alembic, SQLite, managed with uv
  app/
    main.py             app factory, static mounts, error handler
    settings.py         BaseSettings, the only reader of the environment
    db.py               engine, session dependency
    errors.py           domain exceptions
    models/             SQLModel tables
    schemas/            Pydantic request/response models, step configs
    routers/            admin/, participant.py, images.py
    services/           business logic, no FastAPI imports
    storage/            S3-compatible object storage client
  alembic/
  tests/
frontend/
  admin/                Vite + React + TypeScript + Tailwind + shadcn/ui + dnd-kit
  participant/          Vite + TypeScript + jsPsych, fully self-hosted
docs/adr/               architecture decision records
docker-compose.yml      app, seaweedfs, caddy
Caddyfile
```

## Commands

```bash
# Backend (run inside backend/)
uv sync
uv run pytest
uv run ruff check . && uv run ruff format --check .
uv run pyright
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --no-access-log

# Frontends (run inside frontend/admin or frontend/participant)
npm install
npm run dev
npm run build
npm run lint
npm run typecheck
npm test

# Everything
docker compose up --build
```

## Privacy invariants

These are hard rules. A change that breaks one is wrong even if every test passes. Detail: [`.agents/rules/privacy.md`](.agents/rules/privacy.md).

1. No IP address is stored or logged anywhere: not by the app, uvicorn or Caddy.
2. Participant pages load nothing from third parties: no CDNs, web fonts or analytics.
3. No session data exists before consent. Withdrawal hard-deletes the session.
4. Exports contain only the anonymous participant ID, never anything identifying.
5. A stimulus is never shown twice to the same session, including after refresh or Back.

## Product rules worth knowing

- Variants belong to the form. A participant gets one variant for the whole form.
- A published form accepts text edits only. Steps, options and variants are frozen.
- Assignment picks the variant with the fewest completed or recently active sessions, with a random tie-break, inside one transaction.
- Every form starts with a consent step that can be reworded but not removed.

## Rules and skills

Read the rule that matches the files you touch before editing them.

| Rule | Applies to |
|---|---|
| [`architecture.md`](.agents/rules/architecture.md) | backend structure, layering, transactions |
| [`python.md`](.agents/rules/python.md) | all Python |
| [`fastapi.md`](.agents/rules/fastapi.md) | routers, schemas, dependencies |
| [`frontend.md`](.agents/rules/frontend.md) | admin and participant frontends |
| [`privacy.md`](.agents/rules/privacy.md) | anything touching participants, logging, exports, deployment |

`.claude/rules` and `.claude/skills` are symlinks to `.agents/`. Edit the files under `.agents/`.

| Skill | Use it for |
|---|---|
| `impeccable` | any admin UI design or polish; it owns `PRODUCT.md` and `DESIGN.md` |
| `convention-review` (and the `code-reviewer` agent) | review after a non-trivial change |
| `architecture-decision-records` | recording a structural decision under `docs/adr/` |
| `git-commit-message` | drafting a commit message; it never commits |
| `grilling` | stress-testing a plan before building |

## Definition of done

- Backend: `pytest`, `ruff check`, `ruff format --check` and `pyright` pass.
- Frontend: `lint`, `typecheck` and `build` pass for the app you changed.
- A model change has an Alembic revision.
- A new step type has all five parts: config schema, participant plugin, editor card, CSV columns, tests.
- UI changes were looked at in a browser at phone and laptop widths.
- Commit only when asked.
