# Local development image for one frontend app: Node and that app's packages.
# APP is "admin" or "participant". docker/compose/local.yml mounts the app's src/ over the copy made here.
FROM node:24-alpine

ARG APP

WORKDIR /app

COPY frontend/${APP}/package.json frontend/${APP}/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY frontend/${APP}/ ./

# Used by the participant service only.
COPY docker/scripts/local/participant.sh /participant-watch.sh
RUN chmod +x /participant-watch.sh
