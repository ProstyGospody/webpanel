#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-/opt/proxy-panel/.env.generated}"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

PANEL_API_PORT="${PANEL_API_PORT:-18080}"
SMOKE_ADMIN_EMAIL="${SMOKE_ADMIN_EMAIL:-${INITIAL_ADMIN_EMAIL:-}}"
SMOKE_ADMIN_PASSWORD="${SMOKE_ADMIN_PASSWORD:-${INITIAL_ADMIN_PASSWORD:-}}"

services=(proxy-panel-api proxy-panel-web hysteria-server mtproxy caddy)
for service in "${services[@]}"; do
  systemctl is-active --quiet "${service}.service"
  echo "[ok] ${service}.service is active"
done

curl -fsS "http://127.0.0.1:${PANEL_API_PORT}/healthz" >/dev/null
curl -fsS "http://127.0.0.1:${PANEL_API_PORT}/readyz" >/dev/null
echo "[ok] panel-api health and readiness checks passed"

if [[ -n "${SMOKE_ADMIN_EMAIL}" && -n "${SMOKE_ADMIN_PASSWORD}" ]]; then
  cookie_jar="$(mktemp)"
  login_payload="$(jq -nc --arg email "${SMOKE_ADMIN_EMAIL}" --arg password "${SMOKE_ADMIN_PASSWORD}" '{email:$email,password:$password}')"

  login_response="$(curl -fsS -c "${cookie_jar}" -H 'Content-Type: application/json' -d "${login_payload}" "http://127.0.0.1:${PANEL_API_PORT}/api/auth/login")"
  csrf_token="$(echo "${login_response}" | jq -r '.csrf_token // empty')"
  if [[ -z "${csrf_token}" ]]; then
    echo "[error] login response did not contain csrf_token" >&2
    exit 1
  fi

  curl -fsS -b "${cookie_jar}" "http://127.0.0.1:${PANEL_API_PORT}/api/auth/me" >/dev/null
  rm -f "${cookie_jar}"
  echo "[ok] admin login smoke check passed"
else
  echo "[warn] skipped admin login smoke check (credentials not provided)"
fi

echo "All smoke checks passed"

