# Build both frontends, then run the backend, which serves them.

FROM node:24-alpine AS frontends
WORKDIR /build
COPY frontend/participant/package.json frontend/participant/package-lock.json participant/
COPY frontend/admin/package.json frontend/admin/package-lock.json admin/
RUN cd participant && npm ci && cd ../admin && npm ci
COPY frontend/participant participant
COPY frontend/admin admin
RUN cd participant && npm run build && cd ../admin && npm run build


FROM python:3.12-slim AS app
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    DATABASE_PATH=/data/glancelab.db \
    STATIC_DIR=/app/static
WORKDIR /app

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/alembic.ini ./
COPY backend/alembic alembic
COPY backend/app app
COPY --from=frontends /build/admin/dist static/admin
COPY --from=frontends /build/participant/dist static/participant

RUN useradd --system --uid 1000 glancelab && mkdir /data && chown glancelab /data
USER glancelab
VOLUME /data
EXPOSE 8000

# No access log: request lines would contain client IP addresses.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log --proxy-headers --forwarded-allow-ips='*'"]
