# syntax=docker/dockerfile:1.6
ARG NODE_VERSION=22-slim
ARG PNPM_VERSION=10.30.1

FROM node:${NODE_VERSION}
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm run dev:bootstrap

EXPOSE 3000
CMD ["pnpm", "run", "dev:all"]
