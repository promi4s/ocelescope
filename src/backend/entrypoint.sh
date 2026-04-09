#!/bin/sh
set -eu

mkdir -p "${PLUGIN_DIR:-/plugins}" "${DATA_DIR:-/data}"

# Ensure the runtime user can write into volume mounts
chown -R nonroot:nonroot "${PLUGIN_DIR:-/plugins}" "${DATA_DIR:-/data}" || true

exec su -s /bin/sh -c "$*" nonroot
