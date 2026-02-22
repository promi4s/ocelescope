# syntax=docker.io/docker/dockerfile:1

FROM node:20-alpine

# System dependencies (useful for some packages)
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

COPY . .

RUN \
  if [ -f yarn.lock ]; then yarn install; \
  elif [ -f package-lock.json ]; then npm install; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install; \
  else echo "No lockfile found." && exit 1; \
  fi

# Expose Next.js dev server port
EXPOSE 3000

# Run the development server
CMD [ "npm", "run", "dev:app" ]

