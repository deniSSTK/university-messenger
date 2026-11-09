FROM node:24.20.0-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/backend
COPY pkg/events /workspace/pkg/events
COPY backend/package*.json backend/.npmrc ./
RUN npm ci
COPY backend/ .
RUN DB_USER=build DB_PASSWORD=build DB_NAME=build npm run prisma:generate
RUN npm run build

FROM node:24.20.0-bookworm-slim
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/backend
COPY --from=build --chown=node:node /workspace/pkg/events /workspace/pkg/events
COPY --from=build --chown=node:node /workspace/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/backend/dist ./dist
COPY --from=build --chown=node:node /workspace/backend/prisma ./prisma
COPY --from=build --chown=node:node /workspace/backend/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /workspace/backend/src/core/config ./src/core/config
COPY --from=build --chown=node:node /workspace/backend/package*.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
