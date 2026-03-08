#!/usr/bin/env bash
set -euo pipefail

RECONFIGURE=0
if [[ "${1:-}" == "--reconfigure" ]]; then
  RECONFIGURE=1
  shift
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_ROOT="/opt/proxy-panel"
SRC_DIR="${APP_ROOT}/current"
BIN_DIR="${APP_ROOT}/bin"
STATE_DIR="${APP_ROOT}/state"
ENV_FILE="${APP_ROOT}/.env.generated"
CREDENTIALS_FILE="/root/proxy-panel-initial-admin.txt"

ETC_ROOT="/etc/proxy-panel"
HY2_DIR="${ETC_ROOT}/hysteria"
MTPROXY_DIR="${ETC_ROOT}/mtproxy"

PANEL_API_PORT="18080"
PANEL_WEB_PORT="13000"

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
  if [[ "${ID}" != "debian" || "${VERSION_ID}" != "12" ]]; then
    fatal "This installer supports Debian 12 only"
  fi
}

version_gte() {
  local required="$1"
  local current="$2"
  [[ "$(printf '%s\n' "${required}" "${current}" | sort -V | head -n1)" == "${required}" ]]
}

install_system_packages() {
  action "Installing system packages"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y \
    ca-certificates \
    curl \
    wget \
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
    postgresql \
    postgresql-contrib \
    caddy \
    sudo
}

install_go() {
  local min_go="1.24.0"
  local go_version="${GO_VERSION:-1.24.3}"

  if command -v go >/dev/null 2>&1; then
    local current_go
    current_go="$(go version | awk '{print $3}' | sed 's/^go//')"
    if version_gte "${min_go}" "${current_go}"; then
      action "Go ${current_go} already installed"
      return
    fi
  fi

  action "Installing Go ${go_version}"
  curl -fsSL "https://go.dev/dl/go${go_version}.linux-amd64.tar.gz" -o /tmp/go.tgz
  rm -rf /usr/local/go
  tar -C /usr/local -xzf /tmp/go.tgz
  ln -sf /usr/local/go/bin/go /usr/local/bin/go
  ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt
}

install_node() {
  local required_major=20
  local install_needed=1

  if command -v node >/dev/null 2>&1; then
    local current_major
    current_major="$(node -v | sed 's/^v//' | cut -d. -f1)"
    if [[ "${current_major}" -ge "${required_major}" ]]; then
      install_needed=0
      action "Node.js $(node -v) already installed"
    fi
  fi

  if [[ "${install_needed}" -eq 1 ]]; then
    action "Installing Node.js 22"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi
}

install_hysteria() {
  if command -v hysteria >/dev/null 2>&1; then
    action "Hysteria already installed"
    return
  fi

  action "Installing Hysteria 2"
  curl -fsSL https://get.hy2.sh/ | bash
  command -v hysteria >/dev/null 2>&1 || fatal "Hysteria installation failed"
}

install_mtproxy() {
  if [[ -x /usr/local/bin/mtproto-proxy ]]; then
    action "MTProxy binary already installed"
    return
  fi

  action "Installing MTProxy from official source"
  local src_dir="/usr/local/src/MTProxy"
  if [[ ! -d "${src_dir}" ]]; then
    git clone https://github.com/TelegramMessenger/MTProxy.git "${src_dir}"
  else
    git -C "${src_dir}" fetch --all --tags
    git -C "${src_dir}" pull --ff-only
  fi

  make -C "${src_dir}"
  install -m 0755 "${src_dir}/objs/bin/mtproto-proxy" /usr/local/bin/mtproto-proxy
}

create_system_users() {
  action "Creating system users"

  id -u proxy-panel >/dev/null 2>&1 || useradd --system --home /opt/proxy-panel --shell /usr/sbin/nologin proxy-panel
  id -u hysteria >/dev/null 2>&1 || useradd --system --home /var/lib/hysteria --shell /usr/sbin/nologin hysteria
  id -u mtproxy >/dev/null 2>&1 || useradd --system --home /var/lib/mtproxy --shell /usr/sbin/nologin mtproxy

  usermod -a -G proxy-panel mtproxy || true
}

prepare_directories() {
  action "Preparing directories"

  mkdir -p "${APP_ROOT}" "${BIN_DIR}" "${STATE_DIR}" "${ETC_ROOT}" "${HY2_DIR}" "${MTPROXY_DIR}"
  mkdir -p /var/lib/proxy-panel /var/log/proxy-panel /var/lib/hysteria /var/lib/mtproxy

  chown -R proxy-panel:proxy-panel /var/lib/proxy-panel /var/log/proxy-panel
  chown -R hysteria:hysteria /var/lib/hysteria
  chown -R mtproxy:mtproxy /var/lib/mtproxy

  chown root:hysteria "${HY2_DIR}"
  chmod 750 "${HY2_DIR}"
  chown root:proxy-panel "${MTPROXY_DIR}"
  chmod 770 "${MTPROXY_DIR}"
}

sync_source_tree() {
  action "Syncing repository to ${SRC_DIR}"
  mkdir -p "${SRC_DIR}"
  rsync -a --delete --exclude '.git' "${REPO_ROOT}/" "${SRC_DIR}/"
  chmod +x "${SRC_DIR}/scripts/run-mtproxy.sh" "${SRC_DIR}/scripts/smoke-check.sh" "${SRC_DIR}/tests/smoke.sh" "${SRC_DIR}/deploy/install.sh"
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

  prompt_value INITIAL_ADMIN_EMAIL "Initial admin email" "${INITIAL_ADMIN_EMAIL:-admin@${PANEL_PUBLIC_HOST}}"
  prompt_password INITIAL_ADMIN_PASSWORD "Initial admin password"

  DB_NAME="${DB_NAME:-proxy_panel}"
  DB_USER="${DB_USER:-proxy_panel}"

  generate_if_empty DB_PASSWORD 24
  generate_if_empty INTERNAL_AUTH_TOKEN 32
  generate_if_empty HY2_STATS_SECRET 32
  generate_if_empty MTPROXY_STATS_TOKEN 32
  generate_if_empty SESSION_SECRET 32
  generate_if_empty MTPROXY_FALLBACK_SECRET 16

  APP_ENV="${APP_ENV:-production}"
  PANEL_API_PORT="${PANEL_API_PORT:-18080}"
  PANEL_WEB_PORT="${PANEL_WEB_PORT:-13000}"
  PANEL_API_LISTEN_ADDR="127.0.0.1:${PANEL_API_PORT}"

  PANEL_PUBLIC_URL="https://${PANEL_PUBLIC_HOST}:${PANEL_PUBLIC_PORT}"
  DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?sslmode=disable"
  MIGRATIONS_DIR="${SRC_DIR}/migrations"

  HY2_STATS_URL="http://127.0.0.1:${HY2_STATS_PORT}"
  MTPROXY_STATS_URL="http://127.0.0.1:${MTPROXY_STATS_PORT}"

  SESSION_COOKIE_NAME="${SESSION_COOKIE_NAME:-pp_session}"
  CSRF_COOKIE_NAME="${CSRF_COOKIE_NAME:-pp_csrf}"
  CSRF_HEADER_NAME="${CSRF_HEADER_NAME:-X-CSRF-Token}"
  SESSION_TTL="${SESSION_TTL:-24h}"
  SECURE_COOKIES="${SECURE_COOKIES:-true}"

  HY2_POLL_INTERVAL="${HY2_POLL_INTERVAL:-1m}"
  MTPROXY_POLL_INTERVAL="${MTPROXY_POLL_INTERVAL:-1m}"
  SERVICE_POLL_INTERVAL="${SERVICE_POLL_INTERVAL:-30s}"

  MANAGED_SERVICES="proxy-panel-api,proxy-panel-web,hysteria-server,mtproxy"
  SYSTEMCTL_PATH="/usr/bin/systemctl"
  SUDO_PATH="/usr/bin/sudo"
  JOURNALCTL_PATH="/usr/bin/journalctl"
  SERVICE_LOG_LINES_MAX="200"

  AUTH_RATE_LIMIT_WINDOW="15m"
  AUTH_RATE_LIMIT_BURST="10"

  MTPROXY_SECRETS_PATH="${MTPROXY_DIR}/secrets.list"
  MTPROXY_BINARY_PATH="/usr/local/bin/mtproto-proxy"
  HY2_BINARY_PATH="/usr/local/bin/hysteria"

  AUTO_MIGRATE="false"
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
PANEL_ACME_EMAIL=${PANEL_ACME_EMAIL}

DATABASE_URL=${DATABASE_URL}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
MIGRATIONS_DIR=${MIGRATIONS_DIR}

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
HY2_STATS_PORT=${HY2_STATS_PORT}
HY2_STATS_URL=${HY2_STATS_URL}
HY2_STATS_SECRET=${HY2_STATS_SECRET}
HY2_POLL_INTERVAL=${HY2_POLL_INTERVAL}

MTPROXY_PUBLIC_HOST=${MTPROXY_PUBLIC_HOST}
MTPROXY_PORT=${MTPROXY_PORT}
MTPROXY_STATS_PORT=${MTPROXY_STATS_PORT}
MTPROXY_STATS_URL=${MTPROXY_STATS_URL}
MTPROXY_STATS_TOKEN=${MTPROXY_STATS_TOKEN}
MTPROXY_POLL_INTERVAL=${MTPROXY_POLL_INTERVAL}
MTPROXY_FALLBACK_SECRET=${MTPROXY_FALLBACK_SECRET}

SERVICE_POLL_INTERVAL=${SERVICE_POLL_INTERVAL}
MANAGED_SERVICES=${MANAGED_SERVICES}
SYSTEMCTL_PATH=${SYSTEMCTL_PATH}
SUDO_PATH=${SUDO_PATH}
JOURNALCTL_PATH=${JOURNALCTL_PATH}
SERVICE_LOG_LINES_MAX=${SERVICE_LOG_LINES_MAX}

AUTH_RATE_LIMIT_WINDOW=${AUTH_RATE_LIMIT_WINDOW}
AUTH_RATE_LIMIT_BURST=${AUTH_RATE_LIMIT_BURST}

MTPROXY_SECRETS_PATH=${MTPROXY_SECRETS_PATH}
MTPROXY_BINARY_PATH=${MTPROXY_BINARY_PATH}
HY2_BINARY_PATH=${HY2_BINARY_PATH}

AUTO_MIGRATE=${AUTO_MIGRATE}
EOF

  chown root:proxy-panel "${ENV_FILE}"
  chmod 0640 "${ENV_FILE}"

  cat > "${CREDENTIALS_FILE}" <<EOF
INITIAL_ADMIN_EMAIL=${INITIAL_ADMIN_EMAIL}
INITIAL_ADMIN_PASSWORD=${INITIAL_ADMIN_PASSWORD}
PANEL_PUBLIC_URL=${PANEL_PUBLIC_URL}
EOF
  chmod 0600 "${CREDENTIALS_FILE}"

  cat > /etc/caddy/proxy-panel.env <<EOF
PANEL_PUBLIC_HOST=${PANEL_PUBLIC_HOST}
PANEL_PUBLIC_PORT=${PANEL_PUBLIC_PORT}
PANEL_API_PORT=${PANEL_API_PORT}
PANEL_WEB_PORT=${PANEL_WEB_PORT}
PANEL_ACME_EMAIL=${PANEL_ACME_EMAIL}
EOF
  chmod 0640 /etc/caddy/proxy-panel.env

  mkdir -p /etc/systemd/system/caddy.service.d
  cat > /etc/systemd/system/caddy.service.d/proxy-panel-env.conf <<'EOF'
[Service]
EnvironmentFile=/etc/caddy/proxy-panel.env
EOF
}

configure_postgres() {
  action "Configuring PostgreSQL"
  systemctl enable --now postgresql

  runuser -u postgres -- psql -v ON_ERROR_STOP=1 <<SQL
DO
\$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
        CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
    ELSE
        ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
    END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}')
\gexec

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
}

build_backend() {
  action "Building Go backend"
  export PATH="/usr/local/go/bin:${PATH}"
  pushd "${SRC_DIR}" >/dev/null
  GOFLAGS="-mod=mod" go mod tidy
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

render_runtime_configs() {
  action "Rendering runtime configs"

  install -m 0644 "${SRC_DIR}/config/templates/Caddyfile.tmpl" /etc/caddy/Caddyfile

  cat > "${HY2_DIR}/server.yaml" <<EOF
listen: :${HY2_PORT}

acme:
  domains:
    - ${HY2_DOMAIN}
  email: ${PANEL_ACME_EMAIL}
  type: http

auth:
  type: http
  http:
    url: http://127.0.0.1:${PANEL_API_PORT}/internal/hy2/auth?token=${INTERNAL_AUTH_TOKEN}
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
  chown root:hysteria "${HY2_DIR}/server.yaml"
  chmod 0640 "${HY2_DIR}/server.yaml"

  cat > "${MTPROXY_DIR}/runtime.env" <<EOF
MTPROXY_PORT=${MTPROXY_PORT}
MTPROXY_STATS_PORT=${MTPROXY_STATS_PORT}
MTPROXY_PUBLIC_HOST=${MTPROXY_PUBLIC_HOST}
MTPROXY_BINARY_PATH=${MTPROXY_BINARY_PATH}
MTPROXY_SECRETS_FILE=${MTPROXY_SECRETS_PATH}
MTPROXY_FALLBACK_SECRET=${MTPROXY_FALLBACK_SECRET}
MTPROXY_WORKDIR=/var/lib/mtproxy
MTPROXY_ENABLE_HTTP_STATS=true
EOF

  if [[ ! -f "${MTPROXY_SECRETS_PATH}" || ! -s "${MTPROXY_SECRETS_PATH}" ]]; then
    echo "${MTPROXY_FALLBACK_SECRET}" > "${MTPROXY_SECRETS_PATH}"
  fi

  chown root:proxy-panel "${MTPROXY_DIR}/runtime.env" "${MTPROXY_SECRETS_PATH}"
  chmod 0660 "${MTPROXY_DIR}/runtime.env" "${MTPROXY_SECRETS_PATH}"
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

run_migrations() {
  action "Running database migrations"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  "${BIN_DIR}/panel-api" migrate
}

bootstrap_admin() {
  action "Bootstrapping admin account"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  "${BIN_DIR}/panel-api" bootstrap-admin --email "${INITIAL_ADMIN_EMAIL}" --password "${INITIAL_ADMIN_PASSWORD}"
  touch "${STATE_DIR}/admin_bootstrapped"
}

start_services() {
  action "Starting services"
  systemctl enable --now caddy
  systemctl enable --now hysteria-server.service
  systemctl enable --now mtproxy.service
  systemctl enable --now proxy-panel-api.service
  systemctl enable --now proxy-panel-web.service
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

Systemd services:
  - proxy-panel-api.service
  - proxy-panel-web.service
  - hysteria-server.service
  - mtproxy.service
  - caddy.service

Useful commands:
  systemctl status proxy-panel-api proxy-panel-web hysteria-server mtproxy caddy
  journalctl -u proxy-panel-api -n 100 --no-pager
  bash ${SRC_DIR}/scripts/smoke-check.sh ${ENV_FILE}
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

  load_existing_values
  collect_configuration
  write_env_files

  configure_postgres
  build_backend
  build_frontend

  render_runtime_configs
  install_sudoers_policy
  install_systemd_units

  run_migrations
  bootstrap_admin
  start_services
  run_smoke_checks

  print_summary
}

main "$@"





