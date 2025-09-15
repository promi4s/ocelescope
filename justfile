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
  mkdocs serve


up env:
    @if [ "{{env}}" = "dev" ]; then \
        echo "🚀 Starting DEV in watch mode..."; \
        docker compose -f docker-compose.dev.yml up --build --watch; \
    elif [ "{{env}}" = "prod" ]; then \
        echo "🔧 Building DEV before starting PROD..."; \
        docker compose -f docker-compose.dev.yml build; \
        docker compose -f docker-compose.prod.yml up -d; \
    else \
        echo "Invalid environment: {{env}} (use 'dev' or 'prod')"; \
        exit 1; \
    fi


  
