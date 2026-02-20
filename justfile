default: 
  just --list

# Run mkdocs locally
docs $PYTHONPATH="src/ocelescope/src":
  uvx \
  --with mkdocs-material \
  --with mkdocs-awesome-nav \
  --with mkdocs-git-revision-date-localized-plugin \
  --with mkdocs-minify-plugin \
  --with mkdocstrings-python \
  --with mkdocs-autorefs \
  mkdocs serve --livereload


up env:
    @if [ "{{env}}" = "dev" ]; then \
        echo "🚀 Starting DEV in watch mode..."; \
        docker compose -f docker-compose.dev.yml up --build --watch; \
    elif [ "{{env}}" = "prod" ]; then \
        docker compose -f docker-compose.yml up --build; \
    else \
        echo "Invalid environment: {{env}} (use 'dev' or 'prod')"; \
        exit 1; \
    fi

[working-directory:'src/frontend']
orval: api
  npm run generate:api 

[working-directory:'src/newFrontend']
build: 
  npm run build --ws

[working-directory: 'src/backend']
api:
  uv run python generate_openapi.py {{justfile_directory()}}/src/newFrontend/packages/api/base
  
[working-directory: 'src/backend']
init_backend:
  uv sync

[working-directory: 'src/frontend']
init_frontend:
  npm i

sync: init_frontend init_backend orval 
  uvx pre-commit install

