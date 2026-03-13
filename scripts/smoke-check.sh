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
MTPROXY_PORT="${MTPROXY_PORT:-443}"
MTPROXY_STATS_PORT="${MTPROXY_STATS_PORT:-3129}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://127.0.0.1:9090}"
PROMETHEUS_ENABLED="${PROMETHEUS_ENABLED:-true}"
SMOKE_ADMIN_EMAIL="${SMOKE_ADMIN_EMAIL:-${INITIAL_ADMIN_EMAIL:-}}"
SMOKE_ADMIN_PASSWORD="${SMOKE_ADMIN_PASSWORD:-${INITIAL_ADMIN_PASSWORD:-}}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-3}"
CURL_MAX_TIME="${CURL_MAX_TIME:-10}"

wait_http_ok() {
  local url="$1"
  local label="$2"
  local attempts="${3:-20}"
  local delay="${4:-1}"
  local i
  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" "$url" >/dev/null; then
      return 0
    fi
    sleep "$delay"
  done
  echo "[error] ${label} did not become ready at ${url}" >&2
  return 1
}

services=(proxy-panel-api proxy-panel-web hysteria-server mtproxy caddy)
if [[ "${PROMETHEUS_ENABLED}" == "true" ]]; then
  services+=(prometheus prometheus-node-exporter)
fi

echo "[step] checking systemd services"
for service in "${services[@]}"; do
  state="$(systemctl is-active "${service}.service" || true)"
  if [[ "${state}" != "active" ]]; then
    echo "[error] ${service}.service state=${state}" >&2
    systemctl status "${service}.service" --no-pager -l || true
    exit 1
  fi
  echo "[ok] ${service}.service is active"
done

echo "[step] checking panel-api health endpoints"
curl -fsS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" "http://127.0.0.1:${PANEL_API_PORT}/healthz" >/dev/null
curl -fsS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" "http://127.0.0.1:${PANEL_API_PORT}/readyz" >/dev/null
echo "[ok] panel-api health and readiness checks passed"

echo "[step] checking mtproxy listener and local stats"
if ! ss -ltn "( sport = :${MTPROXY_PORT} )" | grep -q ":${MTPROXY_PORT}"; then
  echo "[error] mtproxy is not listening on configured public port ${MTPROXY_PORT}" >&2
  exit 1
fi
if ! ss -ltn "( sport = :${MTPROXY_STATS_PORT} )" | grep -q "127.0.0.1:${MTPROXY_STATS_PORT}"; then
  echo "[warn] mtproxy stats port ${MTPROXY_STATS_PORT} is not shown as loopback-only"
fi
curl -fsS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" "http://127.0.0.1:${MTPROXY_STATS_PORT}/stats" >/dev/null || \
curl -fsS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" "http://127.0.0.1:${MTPROXY_STATS_PORT}/" >/dev/null
echo "[ok] mtproxy listener and local stats check passed"

if [[ "${PROMETHEUS_ENABLED}" == "true" ]]; then
  echo "[step] checking prometheus and node_exporter"
  wait_http_ok "${PROMETHEUS_URL}/-/ready" "prometheus readiness" 30 1
  curl -fsS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" "${PROMETHEUS_URL}/api/v1/query?query=up" >/dev/null
  curl -fsS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" "http://127.0.0.1:9100/metrics" >/dev/null
  echo "[ok] prometheus and node_exporter checks passed"
fi

if [[ -n "${SMOKE_ADMIN_EMAIL}" && -n "${SMOKE_ADMIN_PASSWORD}" ]]; then
  echo "[step] checking admin login flow"
  cookie_jar="$(mktemp)"
  trap 'rm -f "${cookie_jar}"' EXIT
  login_payload="$(jq -nc --arg email "${SMOKE_ADMIN_EMAIL}" --arg password "${SMOKE_ADMIN_PASSWORD}" '{email:$email,password:$password}')"

  login_response="$(curl -fsS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" -c "${cookie_jar}" -H 'Content-Type: application/json' -d "${login_payload}" "http://127.0.0.1:${PANEL_API_PORT}/api/auth/login")"
  csrf_token="$(echo "${login_response}" | jq -r '.csrf_token // empty')"
  if [[ -z "${csrf_token}" ]]; then
    echo "[error] login response did not contain csrf_token" >&2
    exit 1
  fi

  curl -fsS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" -b "${cookie_jar}" "http://127.0.0.1:${PANEL_API_PORT}/api/auth/me" >/dev/null
  rm -f "${cookie_jar}"
  trap - EXIT
  echo "[ok] admin login smoke check passed"
else
  echo "[warn] skipped admin login smoke check (credentials not provided)"
fi

echo "All smoke checks passed"
