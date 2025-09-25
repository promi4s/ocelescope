# Step 1: Build the application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install; \
  elif [ -f package-lock.json ]; then npm ci; \
  else echo "No lock file found!" && exit 1; fi

# Copy the rest of the app and build it
COPY . .
RUN npm run generate:api
RUN npm run build

# Step 2: Create a lightweight production image
FROM node:20-alpine AS runner

WORKDIR /app

# Only copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Set environment variables
ENV NODE_ENV production

# Expose Next.js port
EXPOSE 3000

# Start the app
CMD ["node_modules/.bin/next", "start"]
