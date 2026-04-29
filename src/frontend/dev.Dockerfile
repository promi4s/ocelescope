ARG NODE_VERSION=22-slim
ARG PNPM_VERSION=10.30.1

FROM node:${NODE_VERSION}
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

ENV EXTERNAL_API_BASE_URL="http://backend:8000"

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY . .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

EXPOSE 3000
CMD ["pnpm", "run", "dev:app"]
