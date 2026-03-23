# syntax=docker/dockerfile:1.7
FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=0 \
    UV_LINK_MODE=copy \
    UV_NO_DEV=1 \
    UV_PYTHON_DOWNLOADS=0

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      git \
      graphviz \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

# Copy only dependency manifests first (best cache behavior)
COPY pyproject.toml uv.lock ./

# Install all locked deps without workspace code
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-workspace

# Now bring in the workspace packages
COPY src/backend /app/src/backend
COPY src/ocelescope /app/src/ocelescope

# Install the actual package (still locked)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --package ocelescope-backend

ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app/src/backend
EXPOSE 8000
CMD ["fastapi", "dev", "app", "--host", "0.0.0.0", "--port", "8000"]

