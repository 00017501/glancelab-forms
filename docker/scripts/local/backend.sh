#!/bin/sh
# Entrypoint of the local backend container: prepare, migrate, then run the given command.
set -eu

# Made first so the backend mounts the folder even before the participant app has been built.
mkdir -p "${STATIC_DIR:-/static}/participant/assets"

alembic upgrade head

exec "$@"
