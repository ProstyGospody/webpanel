#!/usr/bin/env bash
set -euo pipefail

MTPROXY_BINARY_PATH="${MTPROXY_BINARY_PATH:-/usr/local/bin/mtproto-proxy}"
MTPROXY_PORT="${MTPROXY_PORT:-443}"
MTPROXY_STATS_PORT="${MTPROXY_STATS_PORT:-3129}"
MTPROXY_ACTIVE_SECRET_FILE="${MTPROXY_ACTIVE_SECRET_FILE:-/etc/proxy-panel/mtproxy/active-secret.txt}"
MTPROXY_PROXY_SECRET_PATH="${MTPROXY_PROXY_SECRET_PATH:-/var/lib/mtproxy/proxy-secret}"
MTPROXY_PROXY_CONFIG_PATH="${MTPROXY_PROXY_CONFIG_PATH:-/var/lib/mtproxy/proxy-multi.conf}"
MTPROXY_ENABLE_HTTP_STATS="${MTPROXY_ENABLE_HTTP_STATS:-true}"

normalize_secret() {
  local raw
  raw="$(echo "$1" | tr 'A-F' 'a-f' | tr -d '[:space:]')"

  if [[ "${raw}" =~ ^(dd|ee)[0-9a-f]{32}([0-9a-f]+)?$ ]]; then
    echo "${raw:2:32}"
    return
  fi
  if [[ "${raw}" =~ ^[0-9a-f]{32}$ ]]; then
    echo "${raw}"
    return
  fi
  echo ""
}

[[ -x "${MTPROXY_BINARY_PATH}" ]] || {
  echo "MTProxy binary not found at ${MTPROXY_BINARY_PATH}" >&2
  exit 1
}
[[ -s "${MTPROXY_PROXY_SECRET_PATH}" ]] || {
  echo "Telegram proxy-secret asset is missing at ${MTPROXY_PROXY_SECRET_PATH}" >&2
  exit 1
}
[[ -s "${MTPROXY_PROXY_CONFIG_PATH}" ]] || {
  echo "Telegram proxy config asset is missing at ${MTPROXY_PROXY_CONFIG_PATH}" >&2
  exit 1
}
[[ -f "${MTPROXY_ACTIVE_SECRET_FILE}" ]] || {
  echo "Active MTProxy secret file is missing at ${MTPROXY_ACTIVE_SECRET_FILE}" >&2
  exit 1
}

candidate="$(grep -m1 -E '^(dd|ee)?[0-9a-fA-F]{32}([0-9a-fA-F]+)?$' "${MTPROXY_ACTIVE_SECRET_FILE}" || true)"
primary_secret="$(normalize_secret "${candidate}")"
if [[ -z "${primary_secret}" ]]; then
  echo "No valid MTProxy secret found in ${MTPROXY_ACTIVE_SECRET_FILE}" >&2
  exit 1
fi

args=(
  -u mtproxy
  -p "${MTPROXY_STATS_PORT}"
  -H "${MTPROXY_PORT}"
  -S "${primary_secret}"
  --aes-pwd "${MTPROXY_PROXY_SECRET_PATH}"
  "${MTPROXY_PROXY_CONFIG_PATH}"
  -M 1
)

if [[ "${MTPROXY_ENABLE_HTTP_STATS}" == "true" ]]; then
  args+=(--http-stats)
fi

exec "${MTPROXY_BINARY_PATH}" "${args[@]}"
