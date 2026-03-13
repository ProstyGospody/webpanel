#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-}"
if [[ -n "${ENV_FILE}" && -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

MTPROXY_PROXY_SECRET_PATH="${MTPROXY_PROXY_SECRET_PATH:-/var/lib/mtproxy/proxy-secret}"
MTPROXY_PROXY_CONFIG_PATH="${MTPROXY_PROXY_CONFIG_PATH:-/var/lib/mtproxy/proxy-multi.conf}"
MTPROXY_PROXY_SECRET_URL="${MTPROXY_PROXY_SECRET_URL:-https://core.telegram.org/getProxySecret}"
MTPROXY_PROXY_CONFIG_URL="${MTPROXY_PROXY_CONFIG_URL:-https://core.telegram.org/getProxyConfig}"

log() {
  printf '[mtproxy-assets] %s\n' "$1"
}

fatal() {
  printf '[mtproxy-assets][error] %s\n' "$1" >&2
  exit 1
}

ensure_asset_owner() {
  local path="$1"
  if id -u mtproxy >/dev/null 2>&1; then
    chown mtproxy:mtproxy "$path"
  fi
  chmod 0640 "$path"
}

fetch_asset() {
  local url="$1"
  local path="$2"
  local label="$3"

  mkdir -p "$(dirname "${path}")"
  local tmp_path="${path}.tmp"
  if curl -fL --connect-timeout 10 --max-time 60 --retry 2 --retry-delay 1 "$url" -o "$tmp_path"; then
    [[ -s "$tmp_path" ]] || fatal "Downloaded ${label} is empty from ${url}"
    install -m 0640 "$tmp_path" "$path"
    rm -f "$tmp_path"
    ensure_asset_owner "$path"
    log "Updated ${label} at ${path}"
    return 0
  fi

  rm -f "$tmp_path"
  if [[ -s "$path" ]]; then
    ensure_asset_owner "$path"
    log "Download failed for ${label}; keeping existing ${path}"
    return 0
  fi

  fatal "Failed to download ${label} from ${url} and no existing local copy is available"
}

fetch_asset "$MTPROXY_PROXY_SECRET_URL" "$MTPROXY_PROXY_SECRET_PATH" "proxy-secret"
fetch_asset "$MTPROXY_PROXY_CONFIG_URL" "$MTPROXY_PROXY_CONFIG_PATH" "proxy config"
