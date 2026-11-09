FROM node:24.20.0-bookworm-slim AS build
WORKDIR /workspace/frontend
COPY pkg/events /workspace/pkg/events
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /workspace/frontend/dist/app/browser /srv
COPY frontend/Caddyfile /etc/caddy/Caddyfile
