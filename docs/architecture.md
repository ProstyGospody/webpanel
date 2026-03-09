# Architecture

## High-level

Single-node architecture on Debian 12:

- Data plane:
  - Hysteria 2 (`443/udp`)
  - MTProxy (`443/tcp`)
- Control plane:
  - `panel-api` on `127.0.0.1:18080`
  - `panel-web` (Next.js) on `127.0.0.1:13000`
  - Caddy TLS entrypoint on `${PANEL_PUBLIC_PORT}` (default `8443`)
- Metrics plane:
  - `prometheus` on `127.0.0.1:9090`
  - `prometheus-node-exporter` on `127.0.0.1:9100`

PostgreSQL is local-only and not exposed externally.

## Service interactions

- Admin UI uses `/api/*` exposed by Caddy and routed to `panel-api`
- Hysteria external auth calls `POST /internal/hy2/auth` on `panel-api`
- Hysteria traffic stats API is loopback-only (`127.0.0.1:${HY2_STATS_PORT}`)
- MTProxy stats endpoint is loopback-only (`127.0.0.1:${MTPROXY_STATS_PORT}`)
- `panel-api` background scheduler polls Hysteria/MTProxy stats and service states
- `panel-api` live dashboard endpoint (`/api/system/live`) combines:
  - Prometheus-based host metrics (CPU/RAM/uptime/network)
  - live Hysteria/MTProxy counters
  - live service status with cache fallback
- `panel-api` writes snapshots/states to PostgreSQL for history and fallback
- Hysteria runtime config source of truth: `${HY2_CONFIG_PATH}` (default `/etc/proxy-panel/hysteria/server.yaml`)

## Database model

Implemented entities:

- `admins`
- `admin_sessions`
- `audit_logs`
- `clients`
- `hy2_accounts`
- `hy2_traffic_snapshots`
- `mtproxy_secrets`
- `mtproxy_stats_snapshots`
- `services_state`
- `nodes`

## Security

- `panel-api` and `panel-web` do not run as root
- Session auth with secure cookies
- Password hashing with bcrypt
- CSRF protection for state-changing API requests
- Basic login rate-limiting by IP
- Strictly local bindings for internal/stats/metrics endpoints
- Restricted sudoers policy for `proxy-panel` user (specific `systemctl`/`journalctl` commands only)
- `.env.generated` permissions: `root:proxy-panel` with `0640`

## Background jobs

Implemented in-process scheduler (`internal/scheduler`):

- Hysteria online/traffic polling
- Hysteria snapshots
- MTProxy stats polling
- Service health polling
- MTProxy runtime secret sync and conditional restart

## MTProxy runtime mode

- Runtime uses one active secret at a time.
- When a secret is enabled via panel API/UI, it becomes runtime-active and other secrets are auto-disabled.
- `tg://proxy` links are generated from the active runtime secret in Telegram-compatible `dd<secret>` format.
