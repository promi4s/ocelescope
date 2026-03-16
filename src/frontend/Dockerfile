# syntax=docker/dockerfile:1.6
ARG NODE_VERSION=22-slim

FROM node:${NODE_VERSION} AS deps
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY app ./app
COPY packages ./packages
COPY modules ./modules

RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

RUN pnpm install --frozen-lockfile

FROM node:${NODE_VERSION} AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /repo/package.json ./package.json

COPY app ./app
COPY packages ./packages
COPY modules ./modules

RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@ocelescope/app..." build

FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder --chown=node:node /repo/app/public ./public

RUN mkdir .next
RUN chown node:node .next

COPY --from=builder /repo/app/.next/standalone ./
COPY --from=builder /repo/app/.next/static ./app/.next/static

USER node
EXPOSE 3000

CMD ["node", "app/server.js"]
