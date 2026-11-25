#!/bin/sh
# Command of the local participant container: build once, then build again whenever a source file changes.
# It checks modification times itself, because file-change events do not always reach a container from the host.
set -eu

STAMP=/tmp/last-build

build() {
    touch "$STAMP.next"
    npx vite build || echo "Build failed; waiting for the next change."
    mv "$STAMP.next" "$STAMP"
}

build
while sleep 1; do
    if [ -n "$(find src index.html vite.config.ts -newer "$STAMP" -print -quit)" ]; then
        build
    fi
done
