# Proxy Panel (Hysteria 2 + MTProxy)

Production-minded single-repo control plane for managing two native services on one Ubuntu 24.04 LTS host:

- Hysteria 2 (data plane stays native on host)
- MTProxy for Telegram (native binary on host)

Control plane stack:

- `panel-api`: Go
- `panel-web`: Next.js 15 + TypeScript + Tailwind
- Local filesystem storage under `/var/lib/proxy-panel`
- Caddy (TLS reverse proxy and certificate issuer)
- Prometheus + node_exporter (live host metrics)
- systemd

## One-command deploy (Ubuntu 24.04 host)

```bash
sudo bash ./deploy/install.sh
```

Compatibility wrapper:

```bash
sudo bash ./deploy/ubuntu24-host-install.sh
```

## What deploy does

Installer phases:

1. Ubuntu 24.04 + root checks
2. Installs host dependencies (Go, Node.js/npm, build tools, Caddy, Prometheus, node_exporter)
3. Installs Hysteria and builds MTProxy
4. Creates system users: `proxy-panel`, `hysteria`, `mtproxy`
5. Generates secrets and runtime env files
6. Builds backend and frontend
7. Renders Hysteria and MTProxy runtime configuration
8. Downloads MTProxy Telegram assets into local disk paths
9. Bootstraps the initial admin and first MTProxy runtime secret into the file-backed store
10. Installs systemd units + restricted sudoers policy
11. Starts panel services, MTProxy, Prometheus, and Caddy
12. Waits for Caddy to issue the Hysteria certificate and syncs it into `/etc/proxy-panel/hysteria/`
13. Starts Hysteria and runs smoke checks

## Generated files and directories

- Main generated env: `/opt/proxy-panel/.env.generated`
- Initial admin credentials file: `/root/proxy-panel-initial-admin.txt`
- File-backed control-plane state: `/var/lib/proxy-panel/state/`
- Historical snapshots: `/var/lib/proxy-panel/snapshots/`
- Backups: `/var/lib/proxy-panel/backups/`
- Audit records: `/var/log/proxy-panel/audit/`
- Runtime locks/temp: `/run/proxy-panel/`
- Hysteria config: `/etc/proxy-panel/hysteria/server.yaml`
- Hysteria synced TLS cert/key: `/etc/proxy-panel/hysteria/tls.crt`, `/etc/proxy-panel/hysteria/tls.key`
- MTProxy active secret file: `/etc/proxy-panel/mtproxy/active-secret.txt`
- MTProxy Telegram assets: `/var/lib/mtproxy/proxy-secret`, `/var/lib/mtproxy/proxy-multi.conf`

## Service names

- `proxy-panel-api.service`
- `proxy-panel-web.service`
- `hysteria-server.service`
- `mtproxy.service`
- `prometheus.service`
- `prometheus-node-exporter.service`
- `caddy.service`

Check status:

```bash
systemctl status proxy-panel-api proxy-panel-web hysteria-server mtproxy prometheus prometheus-node-exporter caddy
```

## Smoke check

```bash
sudo bash ./deploy/verify.sh
```

Or directly:

```bash
sudo bash /opt/proxy-panel/current/scripts/smoke-check.sh /opt/proxy-panel/.env.generated
```

## MTProxy assets

MTProxy no longer fetches `getProxySecret`/`getProxyConfig` on service start. Asset refresh is an explicit maintenance step:

```bash
sudo bash /opt/proxy-panel/current/scripts/update-mtproxy-assets.sh /opt/proxy-panel/.env.generated
sudo systemctl restart mtproxy
```

## Documentation

- [Architecture](./docs/architecture.md)
- [Deploy details](./docs/deploy.md)
- [Operations](./docs/operations.md)

## Local Docker development

Run the control plane only (`panel-api` + `panel-web`) with file-backed state inside `docker/dev-data/`:

```bash
docker compose up --build
```

Open panel:

- `http://localhost:13000`

Default dev admin (from `.env.docker`):

- email: `admin@example.com`
- password: `admin12345`


