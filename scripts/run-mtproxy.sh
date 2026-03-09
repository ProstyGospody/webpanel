#!/usr/bin/env bash
set -euo pipefail

MTPROXY_BINARY_PATH="${MTPROXY_BINARY_PATH:-/usr/local/bin/mtproto-proxy}"
MTPROXY_PORT="${MTPROXY_PORT:-443}"
MTPROXY_STATS_PORT="${MTPROXY_STATS_PORT:-3129}"
MTPROXY_SECRETS_FILE="${MTPROXY_SECRETS_FILE:-/etc/proxy-panel/mtproxy/secrets.list}"
MTPROXY_FALLBACK_SECRET="${MTPROXY_FALLBACK_SECRET:-}"
MTPROXY_WORKDIR="${MTPROXY_WORKDIR:-/var/lib/mtproxy}"
MTPROXY_ENABLE_HTTP_STATS="${MTPROXY_ENABLE_HTTP_STATS:-true}"
MTPROXY_ASSET_MAX_AGE_SECONDS="${MTPROXY_ASSET_MAX_AGE_SECONDS:-86400}"

mkdir -p "${MTPROXY_WORKDIR}"

fetch_if_stale() {
  local path="$1"
  local url="$2"

  if [[ -f "${path}" ]]; then
    local now
    local updated
    now="$(date +%s)"
    updated="$(stat -c %Y "${path}" 2>/dev/null || echo 0)"
    if [[ $((now - updated)) -lt ${MTPROXY_ASSET_MAX_AGE_SECONDS} ]]; then
      return
    fi
  fi

  local tmp_path="${path}.tmp"
  curl -fsSL "${url}" -o "${tmp_path}"
  mv -f "${tmp_path}" "${path}"
}

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

fetch_if_stale "${MTPROXY_WORKDIR}/proxy-secret" "https://core.telegram.org/getProxySecret"
fetch_if_stale "${MTPROXY_WORKDIR}/proxy-multi.conf" "https://core.telegram.org/getProxyConfig"

primary_secret=""
if [[ -f "${MTPROXY_SECRETS_FILE}" ]]; then
  candidate="$(grep -m1 -E '^(dd|ee)?[0-9a-fA-F]{32}([0-9a-fA-F]+)?$' "${MTPROXY_SECRETS_FILE}" || true)"
  primary_secret="$(normalize_secret "${candidate}")"
fi

if [[ -z "${primary_secret}" ]]; then
  primary_secret="$(normalize_secret "${MTPROXY_FALLBACK_SECRET}")"
fi

if [[ -z "${primary_secret}" ]]; then
  echo "No valid MTProxy secret found in ${MTPROXY_SECRETS_FILE} and no fallback configured" >&2
  exit 1
fi

args=(
  -u mtproxy
  # MTProxy official flags:
  # -p = local management/stats port (loopback-only inside MTProxy)
  # -H = public client port used in tg:// links
  -p "${MTPROXY_STATS_PORT}"
  -H "${MTPROXY_PORT}"
  -S "${primary_secret}"
  --aes-pwd "${MTPROXY_WORKDIR}/proxy-secret"
  "${MTPROXY_WORKDIR}/proxy-multi.conf"
  -M 1
)

if [[ "${MTPROXY_ENABLE_HTTP_STATS}" == "true" ]]; then
  args+=(--http-stats)
fi

exec "${MTPROXY_BINARY_PATH}" "${args[@]}"
