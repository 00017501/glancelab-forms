local := "docker compose -f docker/compose/local.yml --profile admin --profile participant"

# List recipes.
default:
    @just --list --unsorted

# ----- Local stack -----

# Build and start everything: backend, image store, admin panel and participant app.
[group('stack')]
up:
    {{ local }} up -d --build
    @echo "Admin panel:  http://localhost:5173/admin/   (researcher / local-dev-password)"
    @echo "Backend API:  http://localhost:8000"

# Build and start the backend and the admin panel only.
[group('stack')]
up-admin:
    docker compose -f docker/compose/local.yml --profile admin up -d --build

# Build and start the backend and the participant app only.
[group('stack')]
up-participant:
    docker compose -f docker/compose/local.yml --profile participant up -d --build

# Stop the local stack. Data is kept.
[group('stack')]
down:
    {{ local }} down

# Rebuild every image without cache and start again.
[group('stack')]
reset: down
    {{ local }} build --no-cache
    {{ local }} up -d

# Follow logs; pass service names to narrow, e.g. `just logs backend`.
[group('stack')]
logs *ARGS:
    {{ local }} logs -f {{ ARGS }}

# Open a shell in a running service: backend (default), admin or participant.
[group('stack')]
shell SERVICE="backend":
    {{ local }} exec {{ SERVICE }} sh

# ----- Database -----

# Autogenerate an Alembic revision.
[group('database')]
makemigrations MESSAGE:
    {{ local }} exec backend alembic revision --autogenerate -m {{ quote(MESSAGE) }}

# Apply pending Alembic revisions.
[group('database')]
migrate:
    {{ local }} exec backend alembic upgrade head

# ----- Checks -----

# Backend tests; extra args go to pytest.
[group('checks')]
test *ARGS:
    {{ local }} exec backend pytest {{ ARGS }}

# Every backend check: tests, lint, format and types.
[group('checks')]
check-backend:
    {{ local }} exec backend sh -c "pytest && ruff check . && ruff format --check . && pyright"

# Every admin check: types, lint and build.
[group('checks')]
check-admin:
    {{ local }} exec admin sh -c "npm run typecheck && npm run lint && npm run build"

# Every participant check: types, lint and tests.
[group('checks')]
check-participant:
    {{ local }} exec participant sh -c "npm run typecheck && npm run lint && npm test"

# Every check for all three parts.
[group('checks')]
check: check-backend check-admin check-participant
