FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_DEV=1 \
    UV_PYTHON_DOWNLOADS=0

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      git \
    && rm -rf /var/lib/apt/lists/*


RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-workspace --no-dev

COPY pyproject.toml uv.lock /app/

COPY src/backend /app/src/backend
COPY src/ocelescope /app/src/ocelescope

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --package ocelescope-backend

FROM python:3.13-slim-bookworm AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
      graphviz \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 999 nonroot \
 && useradd  --system --uid 999 --gid 999 --create-home nonroot

WORKDIR /app

COPY --from=builder --chown=nonroot:nonroot /app /app

RUN mkdir -p /data
COPY --from=data / /data/

ENV PATH="/app/.venv/bin:$PATH"
ENV DATA_DIR="/data"
ENV PLUGIN_DIR="/plugins"

USER nonroot

WORKDIR /app/src/backend/

CMD ["fastapi", "run", "app", "--host", "0.0.0.0"]
