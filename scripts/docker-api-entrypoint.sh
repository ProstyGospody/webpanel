#!/bin/sh
set -eu

cd /workspace

if [ -n "${INITIAL_ADMIN_EMAIL:-}" ] && [ -n "${INITIAL_ADMIN_PASSWORD:-}" ]; then
  echo "[api] preparing initial admin ${INITIAL_ADMIN_EMAIL}"
  go run ./cmd/panel-api bootstrap-admin --email "${INITIAL_ADMIN_EMAIL}" --password "${INITIAL_ADMIN_PASSWORD}"
fi

echo "[api] starting server"
exec go run ./cmd/panel-api serve
