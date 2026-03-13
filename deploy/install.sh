#!/usr/bin/env bash
set -euo pipefail

RECONFIGURE=0
NONINTERACTIVE="${PROXY_PANEL_NONINTERACTIVE:-0}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reconfigure)
      RECONFIGURE=1
      ;;
    --non-interactive)
      NONINTERACTIVE=1
      ;;
    *)
      printf "[error] Unknown argument: %s\n" "$1" >&2
      exit 1
      ;;
  esac
  shift
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_ROOT="/opt/proxy-panel"
SRC_DIR="${APP_ROOT}/current"
BIN_DIR="${APP_ROOT}/bin"
ENV_FILE="${APP_ROOT}/.env.generated"
CREDENTIALS_FILE="/root/proxy-panel-initial-admin.txt"

ETC_ROOT="/etc/proxy-panel"
HY2_DIR="${ETC_ROOT}/hysteria"
MTPROXY_DIR="${ETC_ROOT}/mtproxy"

PANEL_API_PORT="18080"
PANEL_WEB_PORT="13000"

ENV_OVERRIDE_KEYS=(
  PANEL_PUBLIC_HOST
  PANEL_PUBLIC_PORT
  PANEL_ACME_EMAIL
  HY2_DOMAIN
  HY2_PORT
  HY2_STATS_PORT
  MTPROXY_PUBLIC_HOST
  MTPROXY_PORT
  MTPROXY_STATS_PORT
  MTPROXY_TLS_DOMAIN
  INITIAL_ADMIN_EMAIL
  INITIAL_ADMIN_PASSWORD
  PROMETHEUS_ENABLED
)

action() {
  printf "\n==> %s\n" "$1"
}

fatal() {
  printf "[error] %s\n" "$1" >&2
  exit 1
}

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    fatal "Run as root: sudo bash ./deploy/install.sh"
  fi
}

check_os() {
  if [[ ! -f /etc/os-release ]]; then
    fatal "Cannot detect operating system"
  fi
  # shellcheck disable=SC1091
  source /etc/os-release
  if [[ "${ID}" != "ubuntu" || "${VERSION_ID}" != "24.04" ]]; then
    fatal "This installer supports Ubuntu 24.04 only"
  fi
}

version_gte() {
  local required="$1"
  local current="$2"
  [[ "$(printf '%s\n' "${required}" "${current}" | sort -V | head -n1)" == "${required}" ]]
}

is_noninteractive() {
  case "${NONINTERACTIVE}" in
    1|true|TRUE|yes|YES)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

install_system_packages() {
  action "Installing system packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y \
    ca-certificates \
    curl \
    git \
    jq \
    rsync \
    unzip \
    tar \
    lsb-release \
    gnupg \
    build-essential \
    pkg-config \
    libssl-dev \
    zlib1g-dev \
    prometheus \
    prometheus-node-exporter \
    caddy \
    sudo \
    nodejs \
    npm
}

install_go() {
  local min_go="1.24.0"
  local go_version="${GO_VERSION:-1.24.3}"
  local go_url="https://dl.google.com/go/go${go_version}.linux-amd64.tar.gz"

  if command -v go >/dev/null 2>&1; then
    local current_go
    current_go="$(go version | awk '{print $3}' | sed 's/^go//')"
    if version_gte "${min_go}" "${current_go}"; then
      action "Go ${current_go} already installed"
      return
    fi
  fi

  action "Installing Go ${go_version}"
  curl -fsSL "${go_url}" -o /tmp/go.tgz
  rm -rf /usr/local/go
  tar -C /usr/local -xzf /tmp/go.tgz
  ln -sf /usr/local/go/bin/go /usr/local/bin/go
  ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt
}

install_node() {
  local required_major=18
  if ! command -v node >/dev/null 2>&1; then
    fatal "node was not installed by apt on Ubuntu 24.04"
  fi
  local current_major
  current_major="$(node -v | sed 's/^v//' | cut -d. -f1)"
  if [[ "${current_major}" -lt "${required_major}" ]]; then
    fatal "Node.js >= ${required_major} is required, found $(node -v)"
  fi
  action "Node.js $(node -v) already installed"
}

install_hysteria() {
  local version="${HYSTERIA_VERSION:-2.6.5}"
  local url="https://github.com/apernet/hysteria/releases/download/app%2Fv${version}/hysteria-linux-amd64"

  if [[ -x /usr/local/bin/hysteria ]]; then
    action "Hysteria already installed"
    return
  fi

  action "Installing Hysteria ${version}"
  curl -fsSL "${url}" -o /tmp/hysteria-linux-amd64
  install -m 0755 /tmp/hysteria-linux-amd64 /usr/local/bin/hysteria
  command -v hysteria >/dev/null 2>&1 || fatal "Hysteria installation failed"
}

install_mtproxy() {
  local ref="${MTPROXY_GIT_REF:-master}"
  local src_dir="/usr/local/src/MTProxy"

  if [[ ! -d "${src_dir}" ]]; then
    action "Cloning MTProxy source (${ref})"
    git clone https://github.com/TelegramMessenger/MTProxy.git "${src_dir}"
  else
    action "Updating MTProxy source (${ref})"
    git -C "${src_dir}" fetch --all --tags
  fi

  git -C "${src_dir}" checkout --force "${ref}"
  make -C "${src_dir}"
  install -m 0755 "${src_dir}/objs/bin/mtproto-proxy" /usr/local/bin/mtproto-proxy
}

create_system_users() {
  action "Creating system users"

  id -u proxy-panel >/dev/null 2>&1 || useradd --system --home /opt/proxy-panel --shell /usr/sbin/nologin proxy-panel
  id -u hysteria >/dev/null 2>&1 || useradd --system --home /var/lib/hysteria --shell /usr/sbin/nologin hysteria
  id -u mtproxy >/dev/null 2>&1 || useradd --system --home /var/lib/mtproxy --shell /usr/sbin/nologin mtproxy

  usermod -a -G proxy-panel mtproxy || true
  usermod -a -G proxy-panel hysteria || true
}

capture_env_overrides() {
  local key
  for key in "${ENV_OVERRIDE_KEYS[@]}"; do
    if [[ -n "${!key+x}" ]]; then
      printf -v "__OVERRIDE_${key}" '%s' "${!key}"
    fi
  done
}

apply_env_overrides() {
  local key override_name
  for key in "${ENV_OVERRIDE_KEYS[@]}"; do
    override_name="__OVERRIDE_${key}"
    if [[ -n "${!override_name+x}" ]]; then
      printf -v "${key}" '%s' "${!override_name}"
    fi
  done
}

prepare_directories() {
  action "Preparing directories"

  mkdir -p "${APP_ROOT}" "${BIN_DIR}" "${ETC_ROOT}" "${HY2_DIR}" "${MTPROXY_DIR}"
  mkdir -p /var/lib/proxy-panel /var/lib/proxy-panel/backups /var/log/proxy-panel/audit /var/lib/hysteria /var/lib/mtproxy /run/proxy-panel /run/proxy-panel/locks /run/proxy-panel/tmp

  chown -R proxy-panel:proxy-panel /var/lib/proxy-panel /var/log/proxy-panel /run/proxy-panel
  chown -R hysteria:hysteria /var/lib/hysteria
  chown -R mtproxy:mtproxy /var/lib/mtproxy

  chmod 0750 /run/proxy-panel /run/proxy-panel/locks /run/proxy-panel/tmp

  chown root:proxy-panel "${HY2_DIR}" "${MTPROXY_DIR}"
  chmod 2770 "${HY2_DIR}" "${MTPROXY_DIR}"
}

sync_source_tree() {
  action "Syncing repository to ${SRC_DIR}"
  mkdir -p "${SRC_DIR}"
  rsync -a --delete --exclude '.git' "${REPO_ROOT}/" "${SRC_DIR}/"
  chmod +x \
    "${SRC_DIR}/scripts/run-mtproxy.sh" \
    "${SRC_DIR}/scripts/update-mtproxy-assets.sh" \
    "${SRC_DIR}/scripts/smoke-check.sh" \
    "${SRC_DIR}/scripts/sync-hysteria-cert.sh" \
    "${SRC_DIR}/deploy/install.sh" \
    "${SRC_DIR}/deploy/ubuntu24-host-install.sh"
}

load_existing_values() {
  if [[ -f "${ENV_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
  fi
  if [[ -f "${CREDENTIALS_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${CREDENTIALS_FILE}"
  fi
}

prompt_value() {
  local var_name="$1"
  local prompt_text="$2"
  local default_value="$3"
  local current="${!var_name:-}"

  if [[ -n "${current}" && "${RECONFIGURE}" -eq 0 ]]; then
    return
  fi

  if is_noninteractive; then
    if [[ -n "${current}" ]]; then
      return
    fi
    if [[ -n "${default_value}" ]]; then
      printf -v "${var_name}" '%s' "${default_value}"
      return
    fi
    fatal "Value required in non-interactive mode: ${var_name}"
  fi

  local answer=""
  if [[ -n "${current}" ]]; then
    default_value="${current}"
  fi

  if [[ -n "${default_value}" ]]; then
    read -r -p "${prompt_text} [${default_value}]: " answer
    answer="${answer:-${default_value}}"
  else
    read -r -p "${prompt_text}: " answer
  fi

  if [[ -z "${answer}" ]]; then
    fatal "Value required: ${var_name}"
  fi

  printf -v "${var_name}" '%s' "${answer}"
}

prompt_password() {
  local var_name="$1"
  local prompt_text="$2"
  local current="${!var_name:-}"

  if [[ -n "${current}" && "${RECONFIGURE}" -eq 0 ]]; then
    return
  fi

  if is_noninteractive; then
    if [[ -n "${current}" ]]; then
      return
    fi
    local generated
    generated="$(openssl rand -base64 24 | tr -d '=+/\n' | cut -c1-20)"
    printf -v "${var_name}" '%s' "${generated}"
    echo "Generated random initial admin password (non-interactive mode)"
    return
  fi

  local answer=""
  read -r -s -p "${prompt_text} (leave empty to auto-generate): " answer
  echo

  if [[ -z "${answer}" ]]; then
    answer="$(openssl rand -base64 24 | tr -d '=+/\n' | cut -c1-20)"
    echo "Generated random initial admin password"
  fi

  printf -v "${var_name}" '%s' "${answer}"
}

generate_if_empty() {
  local var_name="$1"
  local bytes="$2"
  if [[ -n "${!var_name:-}" ]]; then
    return
  fi
  local value
  value="$(openssl rand -hex "${bytes}")"
  printf -v "${var_name}" '%s' "${value}"
}

collect_configuration() {
  action "Collecting configuration"

  local default_host
  default_host="$(hostname -f 2>/dev/null || hostname)"

  prompt_value PANEL_PUBLIC_HOST "Panel public domain or IP" "${PANEL_PUBLIC_HOST:-${default_host}}"
  prompt_value PANEL_PUBLIC_PORT "Panel HTTPS port" "${PANEL_PUBLIC_PORT:-8443}"
  prompt_value PANEL_ACME_EMAIL "ACME email" "${PANEL_ACME_EMAIL:-admin@${PANEL_PUBLIC_HOST}}"

  prompt_value HY2_DOMAIN "Hysteria public domain" "${HY2_DOMAIN:-${PANEL_PUBLIC_HOST}}"
  prompt_value HY2_PORT "Hysteria UDP port" "${HY2_PORT:-443}"
  prompt_value HY2_STATS_PORT "Hysteria local stats port" "${HY2_STATS_PORT:-8999}"

  prompt_value MTPROXY_PUBLIC_HOST "MTProxy public host/IP" "${MTPROXY_PUBLIC_HOST:-${PANEL_PUBLIC_HOST}}"
  prompt_value MTPROXY_PORT "MTProxy TCP port" "${MTPROXY_PORT:-443}"
  prompt_value MTPROXY_STATS_PORT "MTProxy local stats port" "${MTPROXY_STATS_PORT:-3129}"
  if [[ "${MTPROXY_PUBLIC_HOST}" =~ [A-Za-z] ]]; then
    prompt_value MTPROXY_TLS_DOMAIN "MTProxy TLS camouflage domain (optional)" "${MTPROXY_TLS_DOMAIN:-${MTPROXY_PUBLIC_HOST}}"
  else
    prompt_value MTPROXY_TLS_DOMAIN "MTProxy TLS camouflage domain (optional)" "${MTPROXY_TLS_DOMAIN:-www.cloudflare.com}"
  fi

  prompt_value INITIAL_ADMIN_EMAIL "Initial admin email" "${INITIAL_ADMIN_EMAIL:-admin@${PANEL_PUBLIC_HOST}}"
  prompt_password INITIAL_ADMIN_PASSWORD "Initial admin password"

  generate_if_empty INTERNAL_AUTH_TOKEN 32
  generate_if_empty HY2_STATS_SECRET 32
  generate_if_empty SESSION_SECRET 32
  generate_if_empty BOOTSTRAP_MTPROXY_SECRET 16

  APP_ENV="${APP_ENV:-production}"
  PANEL_API_LISTEN_ADDR="127.0.0.1:${PANEL_API_PORT}"
  PANEL_API_INTERNAL_URL="http://127.0.0.1:${PANEL_API_PORT}"
  PANEL_PUBLIC_URL="https://${PANEL_PUBLIC_HOST}:${PANEL_PUBLIC_PORT}"
  HY2_STATS_URL="http://127.0.0.1:${HY2_STATS_PORT}"
  MTPROXY_STATS_URL="http://127.0.0.1:${MTPROXY_STATS_PORT}"

  PANEL_STORAGE_ROOT="${PANEL_STORAGE_ROOT:-/var/lib/proxy-panel}"
  PANEL_AUDIT_DIR="${PANEL_AUDIT_DIR:-/var/log/proxy-panel/audit}"
  PANEL_RUNTIME_DIR="${PANEL_RUNTIME_DIR:-/run/proxy-panel}"

  PROMETHEUS_ENABLED="${PROMETHEUS_ENABLED:-true}"
  PROMETHEUS_URL="${PROMETHEUS_URL:-http://127.0.0.1:9090}"
  PROMETHEUS_QUERY_TIMEOUT="${PROMETHEUS_QUERY_TIMEOUT:-2s}"

  SESSION_COOKIE_NAME="${SESSION_COOKIE_NAME:-pp_session}"
  CSRF_COOKIE_NAME="${CSRF_COOKIE_NAME:-pp_csrf}"
  CSRF_HEADER_NAME="${CSRF_HEADER_NAME:-X-CSRF-Token}"
  SESSION_TTL="${SESSION_TTL:-24h}"
  SECURE_COOKIES="${SECURE_COOKIES:-true}"

  HY2_POLL_INTERVAL="${HY2_POLL_INTERVAL:-10s}"
  MTPROXY_POLL_INTERVAL="${MTPROXY_POLL_INTERVAL:-10s}"
  SERVICE_POLL_INTERVAL="${SERVICE_POLL_INTERVAL:-30s}"

  MANAGED_SERVICES="proxy-panel-api,proxy-panel-web,hysteria-server,mtproxy"
  SYSTEMCTL_PATH="/usr/bin/systemctl"
  SUDO_PATH="/usr/bin/sudo"
  JOURNALCTL_PATH="/usr/bin/journalctl"
  SERVICE_LOG_LINES_MAX="200"

  AUTH_RATE_LIMIT_WINDOW="15m"
  AUTH_RATE_LIMIT_BURST="10"

  MTPROXY_BINARY_PATH="/usr/local/bin/mtproto-proxy"
  HY2_BINARY_PATH="/usr/local/bin/hysteria"
  HY2_CONFIG_PATH="${HY2_DIR}/server.yaml"
  HY2_CERT_PATH="${HY2_DIR}/tls.crt"
  HY2_KEY_PATH="${HY2_DIR}/tls.key"
  MTPROXY_ACTIVE_SECRET_PATH="${MTPROXY_DIR}/active-secret.txt"
  MTPROXY_PROXY_SECRET_PATH="/var/lib/mtproxy/proxy-secret"
  MTPROXY_PROXY_CONFIG_PATH="/var/lib/mtproxy/proxy-multi.conf"
}

write_env_files() {
  action "Writing generated env files"

  cat > "${ENV_FILE}" <<EOF
APP_ENV=${APP_ENV}
PANEL_API_LISTEN_ADDR=${PANEL_API_LISTEN_ADDR}
PANEL_API_PORT=${PANEL_API_PORT}
PANEL_WEB_PORT=${PANEL_WEB_PORT}
PANEL_PUBLIC_HOST=${PANEL_PUBLIC_HOST}
PANEL_PUBLIC_PORT=${PANEL_PUBLIC_PORT}
PANEL_PUBLIC_URL=${PANEL_PUBLIC_URL}
PANEL_API_INTERNAL_URL=${PANEL_API_INTERNAL_URL}
PANEL_ACME_EMAIL=${PANEL_ACME_EMAIL}
PANEL_STORAGE_ROOT=${PANEL_STORAGE_ROOT}
PANEL_AUDIT_DIR=${PANEL_AUDIT_DIR}
PANEL_RUNTIME_DIR=${PANEL_RUNTIME_DIR}

SESSION_COOKIE_NAME=${SESSION_COOKIE_NAME}
CSRF_COOKIE_NAME=${CSRF_COOKIE_NAME}
CSRF_HEADER_NAME=${CSRF_HEADER_NAME}
SESSION_TTL=${SESSION_TTL}
SECURE_COOKIES=${SECURE_COOKIES}
SESSION_SECRET=${SESSION_SECRET}
INITIAL_ADMIN_EMAIL=${INITIAL_ADMIN_EMAIL}

INTERNAL_AUTH_TOKEN=${INTERNAL_AUTH_TOKEN}

HY2_DOMAIN=${HY2_DOMAIN}
HY2_PORT=${HY2_PORT}
HY2_CONFIG_PATH=${HY2_CONFIG_PATH}
HY2_CERT_PATH=${HY2_CERT_PATH}
HY2_KEY_PATH=${HY2_KEY_PATH}
HY2_STATS_URL=${HY2_STATS_URL}
HY2_STATS_SECRET=${HY2_STATS_SECRET}
HY2_POLL_INTERVAL=${HY2_POLL_INTERVAL}

MTPROXY_PUBLIC_HOST=${MTPROXY_PUBLIC_HOST}
MTPROXY_TLS_DOMAIN=${MTPROXY_TLS_DOMAIN}
MTPROXY_PORT=${MTPROXY_PORT}
MTPROXY_STATS_PORT=${MTPROXY_STATS_PORT}
MTPROXY_STATS_URL=${MTPROXY_STATS_URL}
MTPROXY_POLL_INTERVAL=${MTPROXY_POLL_INTERVAL}
MTPROXY_ACTIVE_SECRET_PATH=${MTPROXY_ACTIVE_SECRET_PATH}
MTPROXY_PROXY_SECRET_PATH=${MTPROXY_PROXY_SECRET_PATH}
MTPROXY_PROXY_CONFIG_PATH=${MTPROXY_PROXY_CONFIG_PATH}

PROMETHEUS_ENABLED=${PROMETHEUS_ENABLED}
PROMETHEUS_URL=${PROMETHEUS_URL}
PROMETHEUS_QUERY_TIMEOUT=${PROMETHEUS_QUERY_TIMEOUT}

SERVICE_POLL_INTERVAL=${SERVICE_POLL_INTERVAL}
MANAGED_SERVICES=${MANAGED_SERVICES}
SYSTEMCTL_PATH=${SYSTEMCTL_PATH}
SUDO_PATH=${SUDO_PATH}
JOURNALCTL_PATH=${JOURNALCTL_PATH}
SERVICE_LOG_LINES_MAX=${SERVICE_LOG_LINES_MAX}

AUTH_RATE_LIMIT_WINDOW=${AUTH_RATE_LIMIT_WINDOW}
AUTH_RATE_LIMIT_BURST=${AUTH_RATE_LIMIT_BURST}

MTPROXY_BINARY_PATH=${MTPROXY_BINARY_PATH}
HY2_BINARY_PATH=${HY2_BINARY_PATH}
EOF

  chown root:proxy-panel "${ENV_FILE}"
  chmod 0640 "${ENV_FILE}"

  cat > "${CREDENTIALS_FILE}" <<EOF
INITIAL_ADMIN_EMAIL=${INITIAL_ADMIN_EMAIL}
INITIAL_ADMIN_PASSWORD=${INITIAL_ADMIN_PASSWORD}
PANEL_PUBLIC_URL=${PANEL_PUBLIC_URL}
INITIAL_MTPROXY_SECRET=${BOOTSTRAP_MTPROXY_SECRET}
EOF
  chmod 0600 "${CREDENTIALS_FILE}"

  cat > /etc/caddy/proxy-panel.env <<EOF
PANEL_PUBLIC_HOST=${PANEL_PUBLIC_HOST}
PANEL_PUBLIC_PORT=${PANEL_PUBLIC_PORT}
PANEL_API_PORT=${PANEL_API_PORT}
PANEL_WEB_PORT=${PANEL_WEB_PORT}
PANEL_ACME_EMAIL=${PANEL_ACME_EMAIL}
HY2_DOMAIN=${HY2_DOMAIN}
EOF
  chmod 0640 /etc/caddy/proxy-panel.env

  mkdir -p /etc/systemd/system/caddy.service.d
  cat > /etc/systemd/system/caddy.service.d/proxy-panel-env.conf <<'EOF'
[Service]
EnvironmentFile=/etc/caddy/proxy-panel.env
EOF
}

render_runtime_configs() {
  action "Rendering runtime configs"

  install -m 0644 "${SRC_DIR}/config/templates/Caddyfile.tmpl" /etc/caddy/Caddyfile
  if [[ "${HY2_DOMAIN}" != "${PANEL_PUBLIC_HOST}" ]]; then
    cat >> /etc/caddy/Caddyfile <<EOF

${HY2_DOMAIN}:${PANEL_PUBLIC_PORT} {
  respond "hysteria-cert-bootstrap" 200
}
EOF
  fi

  cat > "${HY2_DIR}/server.yaml" <<EOF
listen: :${HY2_PORT}

tls:
  cert: ${HY2_CERT_PATH}
  key: ${HY2_KEY_PATH}

auth:
  type: http
  http:
    url: http://127.0.0.1:${PANEL_API_PORT}/internal/hy2/auth/${INTERNAL_AUTH_TOKEN}
    insecure: true

trafficStats:
  listen: 127.0.0.1:${HY2_STATS_PORT}
  secret: ${HY2_STATS_SECRET}

masquerade:
  type: proxy
  proxy:
    url: https://www.cloudflare.com
    rewriteHost: true
EOF
  chown root:proxy-panel "${HY2_DIR}/server.yaml"
  chmod 0660 "${HY2_DIR}/server.yaml"

  cat > "${MTPROXY_DIR}/runtime.env" <<EOF
MTPROXY_PORT=${MTPROXY_PORT}
MTPROXY_STATS_PORT=${MTPROXY_STATS_PORT}
MTPROXY_PUBLIC_HOST=${MTPROXY_PUBLIC_HOST}
MTPROXY_BINARY_PATH=${MTPROXY_BINARY_PATH}
MTPROXY_ACTIVE_SECRET_FILE=${MTPROXY_ACTIVE_SECRET_PATH}
MTPROXY_PROXY_SECRET_PATH=${MTPROXY_PROXY_SECRET_PATH}
MTPROXY_PROXY_CONFIG_PATH=${MTPROXY_PROXY_CONFIG_PATH}
MTPROXY_ENABLE_HTTP_STATS=true
EOF
  chown root:proxy-panel "${MTPROXY_DIR}/runtime.env"
  chmod 0660 "${MTPROXY_DIR}/runtime.env"
}

install_mtproxy_assets() {
  action "Refreshing MTProxy Telegram assets"
  bash "${SRC_DIR}/scripts/update-mtproxy-assets.sh" "${ENV_FILE}"
  chown mtproxy:mtproxy "${MTPROXY_PROXY_SECRET_PATH}" "${MTPROXY_PROXY_CONFIG_PATH}"
  chmod 0640 "${MTPROXY_PROXY_SECRET_PATH}" "${MTPROXY_PROXY_CONFIG_PATH}"
}

build_backend() {
  action "Building Go backend"
  export PATH="/usr/local/go/bin:${PATH}"
  pushd "${SRC_DIR}" >/dev/null
  GOFLAGS="-mod=mod" go mod download
  GOFLAGS="-mod=mod" go build -ldflags "-s -w" -o "${BIN_DIR}/panel-api" ./cmd/panel-api
  popd >/dev/null
  chown root:proxy-panel "${BIN_DIR}/panel-api"
  chmod 0750 "${BIN_DIR}/panel-api"
}

build_frontend() {
  action "Building Next.js frontend"
  pushd "${SRC_DIR}/web" >/dev/null
  npm ci --no-audit --no-fund
  npm run build
  popd >/dev/null
  chown -R proxy-panel:proxy-panel "${SRC_DIR}/web"
}

wait_for_hysteria_certificate() {
  action "Waiting for Caddy to issue Hysteria certificate"
  bash "${SRC_DIR}/scripts/sync-hysteria-cert.sh" "${ENV_FILE}" --wait
}

configure_prometheus() {
  action "Configuring Prometheus and node_exporter"

  local exporter_bin
  exporter_bin="$(command -v prometheus-node-exporter || true)"
  if [[ -z "${exporter_bin}" ]]; then
    fatal "prometheus-node-exporter binary is not installed"
  fi

  cat > /etc/prometheus/prometheus.yml <<'EOF'
global:
  scrape_interval: 5s
  evaluation_interval: 5s

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ['127.0.0.1:9090']

  - job_name: node_exporter
    static_configs:
      - targets: ['127.0.0.1:9100']
EOF

  mkdir -p /etc/systemd/system/prometheus-node-exporter.service.d
  cat > /etc/systemd/system/prometheus-node-exporter.service.d/override.conf <<EOF
[Service]
EnvironmentFile=
ExecStart=
ExecStart=${exporter_bin} --web.listen-address=127.0.0.1:9100
EOF

  systemctl daemon-reload
}

install_sudoers_policy() {
  action "Installing restricted sudoers policy"

  cat > /etc/sudoers.d/proxy-panel-api <<'EOF'
Cmnd_Alias PROXY_PANEL_SHOW = /usr/bin/systemctl show proxy-panel-api --property=ActiveState --property=SubState --property=MainPID --property=ActiveEnterTimestamp, /usr/bin/systemctl show proxy-panel-web --property=ActiveState --property=SubState --property=MainPID --property=ActiveEnterTimestamp, /usr/bin/systemctl show hysteria-server --property=ActiveState --property=SubState --property=MainPID --property=ActiveEnterTimestamp, /usr/bin/systemctl show mtproxy --property=ActiveState --property=SubState --property=MainPID --property=ActiveEnterTimestamp
Cmnd_Alias PROXY_PANEL_RESTART = /usr/bin/systemctl restart proxy-panel-api, /usr/bin/systemctl restart proxy-panel-web, /usr/bin/systemctl restart hysteria-server, /usr/bin/systemctl restart mtproxy
Cmnd_Alias PROXY_PANEL_RELOAD = /usr/bin/systemctl reload proxy-panel-api, /usr/bin/systemctl reload proxy-panel-web, /usr/bin/systemctl reload hysteria-server, /usr/bin/systemctl reload mtproxy
Cmnd_Alias PROXY_PANEL_LOGS = /usr/bin/journalctl -u proxy-panel-api -n * --no-pager --output=short-iso, /usr/bin/journalctl -u proxy-panel-web -n * --no-pager --output=short-iso, /usr/bin/journalctl -u hysteria-server -n * --no-pager --output=short-iso, /usr/bin/journalctl -u mtproxy -n * --no-pager --output=short-iso
proxy-panel ALL=(root) NOPASSWD: PROXY_PANEL_SHOW, PROXY_PANEL_RESTART, PROXY_PANEL_RELOAD, PROXY_PANEL_LOGS
EOF

  chmod 0440 /etc/sudoers.d/proxy-panel-api
  visudo -cf /etc/sudoers.d/proxy-panel-api >/dev/null
}

install_systemd_units() {
  action "Installing systemd units"

  install -m 0644 "${SRC_DIR}/systemd/proxy-panel-api.service" /etc/systemd/system/proxy-panel-api.service
  install -m 0644 "${SRC_DIR}/systemd/proxy-panel-web.service" /etc/systemd/system/proxy-panel-web.service
  install -m 0644 "${SRC_DIR}/systemd/hysteria-server.service" /etc/systemd/system/hysteria-server.service
  install -m 0644 "${SRC_DIR}/systemd/mtproxy.service" /etc/systemd/system/mtproxy.service

  systemctl daemon-reload
}

bootstrap_admin() {
  action "Bootstrapping admin account"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  runuser -u proxy-panel -- "${BIN_DIR}/panel-api" bootstrap-admin --email "${INITIAL_ADMIN_EMAIL}" --password "${INITIAL_ADMIN_PASSWORD}"
}

bootstrap_mtproxy() {
  action "Bootstrapping MTProxy secret"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  runuser -u proxy-panel -- "${BIN_DIR}/panel-api" bootstrap-mtproxy --secret "${BOOTSTRAP_MTPROXY_SECRET}"
}

start_services() {
  action "Starting services"
  systemctl enable prometheus.service
  systemctl enable prometheus-node-exporter.service
  systemctl enable proxy-panel-api.service
  systemctl enable proxy-panel-web.service
  systemctl enable mtproxy.service
  systemctl enable caddy.service
  systemctl enable hysteria-server.service

  systemctl restart prometheus.service
  systemctl restart prometheus-node-exporter.service
  systemctl restart proxy-panel-api.service
  systemctl restart proxy-panel-web.service
  systemctl restart mtproxy.service
  systemctl restart caddy.service

  wait_for_hysteria_certificate
  systemctl restart hysteria-server.service
}

run_smoke_checks() {
  action "Running smoke checks"
  SMOKE_ADMIN_EMAIL="${INITIAL_ADMIN_EMAIL}" SMOKE_ADMIN_PASSWORD="${INITIAL_ADMIN_PASSWORD}" bash "${SRC_DIR}/scripts/smoke-check.sh" "${ENV_FILE}"
}

print_summary() {
  cat <<EOF

Deployment completed.

Panel URL: ${PANEL_PUBLIC_URL}
Initial admin email: ${INITIAL_ADMIN_EMAIL}
Initial admin password file: ${CREDENTIALS_FILE}
Generated env file: ${ENV_FILE}
Storage root: ${PANEL_STORAGE_ROOT}
Audit dir: ${PANEL_AUDIT_DIR}
Active MTProxy secret path: ${MTPROXY_ACTIVE_SECRET_PATH}

Systemd services:
  - proxy-panel-api.service
  - proxy-panel-web.service
  - hysteria-server.service
  - mtproxy.service
  - prometheus.service
  - prometheus-node-exporter.service
  - caddy.service

Useful commands:
  systemctl status proxy-panel-api proxy-panel-web hysteria-server mtproxy prometheus prometheus-node-exporter caddy
  journalctl -u proxy-panel-api -n 100 --no-pager
  bash ${SRC_DIR}/scripts/smoke-check.sh ${ENV_FILE}
  bash ${SRC_DIR}/scripts/update-mtproxy-assets.sh ${ENV_FILE}
  sudo bash ${REPO_ROOT}/deploy/install.sh --reconfigure
EOF
}

main() {
  require_root
  check_os

  install_system_packages
  install_go
  install_node
  install_hysteria
  install_mtproxy

  create_system_users
  prepare_directories
  sync_source_tree

  capture_env_overrides
  load_existing_values
  apply_env_overrides
  collect_configuration
  write_env_files

  build_backend
  build_frontend
  render_runtime_configs
  install_mtproxy_assets
  configure_prometheus
  install_sudoers_policy
  install_systemd_units

  bootstrap_admin
  bootstrap_mtproxy
  start_services
  run_smoke_checks
  print_summary
}

main "$@"




