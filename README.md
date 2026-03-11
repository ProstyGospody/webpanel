# Proxy Panel (Hysteria 2 + MTProxy)

Production-minded single-repo control plane for managing two native services on one Ubuntu 24.04 LTS host:

- Hysteria 2 (data plane stays native on host)
- MTProxy for Telegram (native binary on host)

Control plane stack:

- `panel-api`: Go
- `panel-web`: Next.js 15 + TypeScript + Tailwind
- PostgreSQL
- Caddy (TLS reverse proxy for panel)
- Prometheus + node_exporter (live host metrics)
- systemd

## One-command deploy (Ubuntu 24.04 host + Ansible)

```bash
sudo bash ./deploy/ubuntu24-host-install.sh
```

First run creates `deploy/ansible/group_vars/all.yml` from `all.yml.example` and exits.
Fill values and rerun the same command.

## What deploy does

`deploy/ubuntu24-host-install.sh` installs Ansible and runs `deploy/ansible/site.yml`, which triggers idempotent host installer logic in `deploy/install.sh`.

Installer phases:

1. Ubuntu 24.04 + root checks
2. Installs host dependencies (Go, Node, PostgreSQL, Caddy, Prometheus, node_exporter, build tools)
3. Installs Hysteria 2 and MTProxy binaries
4. Creates system users: `proxy-panel`, `hysteria`, `mtproxy`
5. Generates secrets and runtime env file
6. Builds backend and frontend
7. Applies DB migrations
8. Bootstraps initial admin
9. Installs systemd units + restricted sudoers policy
10. Renders runtime configs (including Prometheus scrape config)
11. Starts services
12. Runs smoke checks

## Configuration source for deploy

Deployment values come from `deploy/ansible/group_vars/all.yml`.

Main variables:

- `panel_public_host`
- `panel_public_port`
- `panel_acme_email`
- `hy2_domain`
- `hy2_port`
- `mtproxy_public_host`
- `mtproxy_port`
- `mtproxy_tls_domain`
- `initial_admin_email`
- `initial_admin_password` (empty => generated)

Everything else is generated or defaulted automatically by installer logic.

## Generated files and secrets

- Main generated env: `/opt/proxy-panel/.env.generated`
- Initial admin credentials file: `/root/proxy-panel-initial-admin.txt`
- Hysteria config: `/etc/proxy-panel/hysteria/server.yaml`
- MTProxy runtime env: `/etc/proxy-panel/mtproxy/runtime.env`
- MTProxy secrets runtime list: `/etc/proxy-panel/mtproxy/secrets.list`
- Prometheus config: `/etc/prometheus/prometheus.yml`

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

## Update flow

From updated repository checkout:

```bash
sudo bash ./deploy/ubuntu24-host-install.sh
```

## Documentation

- [Architecture](./docs/architecture.md)
- [Deploy details](./docs/deploy.md)
- [Operations](./docs/operations.md)

## Local Docker development (local machine only)

Run the full local stack (`panel-api` + `panel-web` + PostgreSQL) without installing Go/Node/PostgreSQL on your host:

```bash
docker compose up --build
```

Open panel:

- `http://localhost:13000`

Default dev admin (from `.env.docker`):

- email: `admin@example.com`
- password: `admin12345`

Useful commands:

```bash
docker compose down
docker compose down -v   # reset DB volume
```

You can change any dev settings in `.env.docker`.
