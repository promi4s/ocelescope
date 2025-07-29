#!/bin/bash

set -e

BACKEND_DIR="src/backend"
FRONTEND_DIR="src/frontend"

SKIP_FRONTEND=false

# Parse arguments
for arg in "$@"; do
  if [[ "$arg" == "--skip-frontend" ]]; then
    SKIP_FRONTEND=true
  fi
done

echo "⚙️ Starting OpenAPI generation..."

# Step 1: Start FastAPI in background
cd "$BACKEND_DIR"
".venv/bin/python" index.py

cd ../..

# Step 4: Generate API in frontend (unless skipped)
if [ "$SKIP_FRONTEND" = false ]; then
  echo "🧬 Generating API client/types..."
  cd "$FRONTEND_DIR"
  npm run generate:api
  cd ../..
else
  echo "⏩ Skipping frontend generation."
fi

echo "✅ OpenAPI generation complete!"
