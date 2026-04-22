#!/bin/sh
set -eu

mkdir -p "${PLUGIN_DIR:-/plugins}" "${DATA_DIR:-/data}"

chown -R nonroot:nonroot "${PLUGIN_DIR:-/plugins}" "${DATA_DIR:-/data}" || true

exec su -s /bin/sh -c "$*" nonroot
