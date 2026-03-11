#!/bin/sh
set -eu

cd /workspace/web

if [ ! -d node_modules ] || [ ! -f node_modules/next/package.json ]; then
  echo "[web] installing npm dependencies..."
  npm ci
fi

echo "[web] starting Next.js dev server"
exec npm run dev -- --hostname 0.0.0.0 --port "${WEB_PORT:-13000}"
