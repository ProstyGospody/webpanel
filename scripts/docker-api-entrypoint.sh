#!/bin/sh
set -eu

cd /workspace

echo "[api] waiting for postgres and applying migrations..."
until go run ./cmd/panel-api migrate; do
  echo "[api] migrate failed, retrying in 2s..."
  sleep 2
done

echo "[api] migrations applied"

if [ -n "${INITIAL_ADMIN_EMAIL:-}" ] && [ -n "${INITIAL_ADMIN_PASSWORD:-}" ]; then
  echo "[api] upserting initial admin ${INITIAL_ADMIN_EMAIL}"
  go run ./cmd/panel-api bootstrap-admin --email "${INITIAL_ADMIN_EMAIL}" --password "${INITIAL_ADMIN_PASSWORD}"
fi

echo "[api] starting server"
exec go run ./cmd/panel-api serve
