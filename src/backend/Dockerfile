FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim@sha256:531f855bda2c73cd6ef67d56b733b357cea384185b3022bd09f05e002cd144ca AS builder

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

FROM python:3.13-slim-bookworm@sha256:c45a22ea000adfd9cda29364bbe7edd23001ce5cc2ad15857cfbf7766943b9ca AS runtime

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
