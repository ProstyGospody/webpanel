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

PostgreSQL is local-only and not exposed externally.

## Service interactions

- Admin UI uses `/api/*` exposed by Caddy and routed to `panel-api`
- Hysteria external auth calls `POST /internal/hy2/auth` on `panel-api`
- Hysteria traffic stats API is loopback-only (`127.0.0.1:${HY2_STATS_PORT}`)
- MTProxy stats endpoint is loopback-only (`127.0.0.1:${MTPROXY_STATS_PORT}`)
- `panel-api` background scheduler polls Hysteria/MTProxy stats and service states
- `panel-api` writes service snapshots and traffic snapshots to PostgreSQL

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
- Strictly local bindings for internal/stats endpoints
- Restricted sudoers policy for `proxy-panel` user (specific `systemctl`/`journalctl` commands only)
- `.env.generated` permissions: `root:proxy-panel` with `0640`

## Background jobs

Implemented in-process scheduler (`internal/scheduler`):

- Hysteria online/traffic polling
- Hysteria snapshots
- MTProxy stats polling
- Service health polling
- MTProxy runtime secret sync and conditional restart

## Known MTProxy runtime limitation

The panel supports multiple secrets in DB and admin model. The runtime wrapper uses the first enabled secret for native MTProxy startup, which is the stable operational default for official MTProxy binary behavior.

