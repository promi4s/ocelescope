ARG NODE_VERSION=22-slim

FROM node:${NODE_VERSION} AS deps
WORKDIR /repo

# pnpm files now live at repo root
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# frontend sources live under src/frontend/...
COPY src/frontend/app ./src/frontend/app
COPY src/frontend/packages ./src/frontend/packages
COPY src/frontend/modules ./src/frontend/modules

RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
RUN pnpm install --frozen-lockfile

FROM node:${NODE_VERSION} AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /repo/package.json ./package.json

COPY src/frontend/app ./src/frontend/app
COPY src/frontend/packages ./src/frontend/packages
COPY src/frontend/modules ./src/frontend/modules

ENV EXTERNAL_API_BASE_URL="http://backend:8000"

RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@ocelescope/app..." build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV EXTERNAL_API_BASE_URL="http://backend:8000"

# Copy the standalone bundle for the app as the runtime root
COPY --from=builder /repo/src/frontend/app/.next/standalone ./

# Static + public
COPY --from=builder /repo/src/frontend/app/.next/static ./src/frontend/app/.next/static
COPY --from=builder --chown=node:node /repo/src/frontend/app/public ./public

USER node
EXPOSE 3000

CMD ["node", "src/frontend/app/server.js"]
