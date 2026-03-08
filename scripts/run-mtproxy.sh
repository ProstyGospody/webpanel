#!/usr/bin/env bash
set -euo pipefail

MTPROXY_BINARY_PATH="${MTPROXY_BINARY_PATH:-/usr/local/bin/mtproto-proxy}"
MTPROXY_PORT="${MTPROXY_PORT:-443}"
MTPROXY_STATS_PORT="${MTPROXY_STATS_PORT:-3129}"
MTPROXY_SECRETS_FILE="${MTPROXY_SECRETS_FILE:-/etc/proxy-panel/mtproxy/secrets.list}"
MTPROXY_FALLBACK_SECRET="${MTPROXY_FALLBACK_SECRET:-}"
MTPROXY_WORKDIR="${MTPROXY_WORKDIR:-/var/lib/mtproxy}"
MTPROXY_ENABLE_HTTP_STATS="${MTPROXY_ENABLE_HTTP_STATS:-true}"

mkdir -p "${MTPROXY_WORKDIR}"

if [[ ! -f "${MTPROXY_WORKDIR}/proxy-secret" ]]; then
  curl -fsSL "https://core.telegram.org/getProxySecret" -o "${MTPROXY_WORKDIR}/proxy-secret"
fi

if [[ ! -f "${MTPROXY_WORKDIR}/proxy-multi.conf" ]]; then
  curl -fsSL "https://core.telegram.org/getProxyConfig" -o "${MTPROXY_WORKDIR}/proxy-multi.conf"
fi

primary_secret=""
if [[ -f "${MTPROXY_SECRETS_FILE}" ]]; then
  primary_secret="$(grep -m1 -E '^[0-9a-fA-F]{32,64}$' "${MTPROXY_SECRETS_FILE}" || true)"
fi

if [[ -z "${primary_secret}" ]]; then
  primary_secret="${MTPROXY_FALLBACK_SECRET}"
fi

if [[ -z "${primary_secret}" ]]; then
  echo "No MTProxy secret found in ${MTPROXY_SECRETS_FILE} and no fallback configured" >&2
  exit 1
fi

args=(
  -u mtproxy
  -p "${MTPROXY_PORT}"
  -H "${MTPROXY_STATS_PORT}"
  -S "${primary_secret}"
  --aes-pwd "${MTPROXY_WORKDIR}/proxy-secret"
  "${MTPROXY_WORKDIR}/proxy-multi.conf"
  -M 1
)

if [[ "${MTPROXY_ENABLE_HTTP_STATS}" == "true" ]]; then
  args+=(--http-stats)
fi

exec "${MTPROXY_BINARY_PATH}" "${args[@]}"
