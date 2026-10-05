FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim@sha256:7cf77f594be8042dab6daa9fe326f90962252268b4f120a7f5dccce4d947e6c1 AS builder

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
  uv sync --frozen --no-dev --all-packages

FROM python:3.14-slim-bookworm@sha256:c8137f4c460908c8763f281c8f22c431eb5c538514ba9553fc3a89c06b7cfb88 AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
  graphviz \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 999 nonroot \
  && useradd --system --uid 999 --gid 999 --create-home nonroot

WORKDIR /app

COPY --from=builder --chown=nonroot:nonroot /app /app
RUN mkdir -p /data
COPY --from=data / /data/

ENV PATH="/app/.venv/bin:$PATH"
ENV DATA_DIR="/data"
ENV PLUGIN_DIR="/plugins"

COPY src/backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER root
ENTRYPOINT ["/entrypoint.sh"]
CMD ["ocelescope-backend", "serve", "--host", "0.0.0.0", "--port", "8000"]
