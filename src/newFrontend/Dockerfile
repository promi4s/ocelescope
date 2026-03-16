# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS deps
WORKDIR /repo
RUN apk add --no-cache libc6-compat

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY app ./app
COPY packages ./packages
COPY modules ./modules

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /repo
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /repo/package.json ./package.json

COPY app ./app
COPY packages ./packages
COPY modules ./modules

RUN pnpm --filter "@ocelescope/app..." build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /repo/app/.next/standalone ./
COPY --from=builder /repo/app/.next/static ./app/.next/static
COPY --from=builder /repo/app/public ./app/public

USER nextjs
EXPOSE 3000

CMD ["node", "app/server.js"]
