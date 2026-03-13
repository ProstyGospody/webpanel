# Architecture

## High-level

Single-node architecture on Ubuntu 24.04 LTS:

- Data plane:
  - Hysteria 2 (`443/udp`)
  - MTProxy (`443/tcp`)
- Control plane:
  - `panel-api` on `127.0.0.1:18080`
  - `panel-web` on `127.0.0.1:13000`
  - Caddy TLS entrypoint on `${PANEL_PUBLIC_PORT}` (default `8443`)
- Metrics plane:
  - `prometheus` on `127.0.0.1:9090`
  - `prometheus-node-exporter` on `127.0.0.1:9100`

No database is used. The panel source of truth is the filesystem on the target host.

## Filesystem source of truth

Ubuntu 24.04 layout used by the control plane:

- `/var/lib/proxy-panel/state/`
  - admins
  - sessions
  - clients
  - Hysteria accounts
  - MTProxy secrets
  - cached service states
  - schema/version metadata
- `/var/lib/proxy-panel/snapshots/`
  - Hysteria traffic snapshots
  - MTProxy stats snapshots
- `/var/lib/proxy-panel/backups/`
  - operator-owned backup/restore target
- `/var/log/proxy-panel/audit/`
  - audit log records
- `/run/proxy-panel/`
  - lock files
  - temp/runtime coordination files
- `/etc/proxy-panel/hysteria/server.yaml`
  - active Hysteria server config
- `/etc/proxy-panel/mtproxy/active-secret.txt`
  - runtime-active MTProxy secret published by the panel
- `/var/lib/mtproxy/proxy-secret`
  - Telegram-provided MTProxy secret asset
- `/var/lib/mtproxy/proxy-multi.conf`
  - Telegram-provided MTProxy config asset

## Service interactions

- Admin UI uses `/api/*` exposed by Caddy and routed to `panel-api`
- Caddy manages ACME certificates for `${PANEL_PUBLIC_HOST}` and `${HY2_DOMAIN}`
- `scripts/sync-hysteria-cert.sh` copies the Caddy-issued Hysteria certificate into `/etc/proxy-panel/hysteria/`
- Hysteria external auth calls `POST /internal/hy2/auth` on `panel-api`
- Hysteria traffic stats API is loopback-only (`127.0.0.1:${HY2_STATS_PORT}`)
- MTProxy stats endpoint is loopback-only (`127.0.0.1:${MTPROXY_STATS_PORT}`)
- `panel-api` background scheduler polls Hysteria/MTProxy stats and service states
- `panel-api` writes snapshots and cached service state into the filesystem store

## Storage behavior

- Writes use temp file + rename publication
- File payloads are fsynced before rename; parent directories are fsynced on Linux publication paths
- Concurrent repository access is serialized behind a lock file in `/run/proxy-panel/locks/`
- Sensitive files are not world-readable
- The control plane updates the same runtime files that systemd services consume

## MTProxy runtime mode

- Only one MTProxy secret is published as runtime-active at a time
- The panel writes the active secret into `/etc/proxy-panel/mtproxy/active-secret.txt`
- `run-mtproxy.sh` reads only local files and never performs network downloads during service start
- Telegram assets are refreshed explicitly via `scripts/update-mtproxy-assets.sh`
- `tg://proxy` links are generated from the stored secret with `dd`/`ee` formatting compatible with the configured camouflage domain
