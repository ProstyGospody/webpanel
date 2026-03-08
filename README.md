# Proxy Panel (Hysteria 2 + MTProxy)

Production-minded single-repo control plane for managing two native services on one Debian 12 VDS:

- Hysteria 2 (data plane stays native on host)
- MTProxy for Telegram (native binary on host)

Control plane stack:

- `panel-api`: Go
- `panel-web`: Next.js 15 + TypeScript + Tailwind
- PostgreSQL
- Caddy (TLS reverse proxy for panel)
- systemd

## One-command deploy

```bash
sudo bash ./deploy/install.sh
```

Reconfigure mode:

```bash
sudo bash ./deploy/install.sh --reconfigure
```

## What deploy does

`deploy/install.sh` is idempotent and performs:

1. Debian 12 + root checks
2. Installs dependencies (Go, Node, PostgreSQL, Caddy, build tools)
3. Installs Hysteria 2 and MTProxy binaries
4. Creates system users: `proxy-panel`, `hysteria`, `mtproxy`
5. Generates secrets and runtime env file
6. Asks only interactive values that cannot be auto-detected
7. Builds backend and frontend
8. Applies DB migrations
9. Bootstraps initial admin
10. Installs systemd units + restricted sudoers policy
11. Starts services
12. Runs smoke checks

## Interactive questions asked by deploy

- Panel public domain/IP
- Panel HTTPS port (default `8443`)
- ACME email
- Hysteria public domain
- MTProxy public host/IP
- Initial admin email
- Initial admin password (empty input -> generated)

Everything else is generated or defaulted automatically.

## Generated files and secrets

- Main generated env: `/opt/proxy-panel/.env.generated`
- Initial admin credentials file: `/root/proxy-panel-initial-admin.txt`
- Hysteria config: `/etc/proxy-panel/hysteria/server.yaml`
- MTProxy runtime env: `/etc/proxy-panel/mtproxy/runtime.env`
- MTProxy secrets runtime list: `/etc/proxy-panel/mtproxy/secrets.list`

## Service names

- `proxy-panel-api.service`
- `proxy-panel-web.service`
- `hysteria-server.service`
- `mtproxy.service`
- `caddy.service`

Check status:

```bash
systemctl status proxy-panel-api proxy-panel-web hysteria-server mtproxy caddy
```

Restart examples:

```bash
systemctl restart proxy-panel-api
systemctl restart proxy-panel-web
systemctl restart hysteria-server
systemctl restart mtproxy
```

## Smoke check

```bash
sudo bash ./deploy/verify.sh
```

or:

```bash
sudo bash /opt/proxy-panel/current/scripts/smoke-check.sh /opt/proxy-panel/.env.generated
```

## Update flow

From updated repository checkout:

```bash
sudo bash ./deploy/install.sh
```

The script syncs repo to `/opt/proxy-panel/current`, rebuilds binaries, keeps generated env/secrets, reapplies units/configs, and restarts services safely.

## Documentation

- [Architecture](./docs/architecture.md)
- [Deploy details](./docs/deploy.md)
- [Operations](./docs/operations.md)

