# Deploy

## Requirements

- Clean Ubuntu 24.04 LTS server
- Root access (or sudo)
- DNS records prepared for panel and Hysteria domains
- Ports open:
  - SSH (`22/tcp`)
  - ACME HTTP challenge (`80/tcp`)
  - Panel (`8443/tcp` by default)
  - Hysteria (`443/udp`)
  - MTProxy (`443/tcp`)

## One-command install

```bash
sudo bash ./deploy/install.sh
```

The installer is interactive and asks for the public hosts, ports, ACME email, and bootstrap admin credentials during deploy.

Compatibility wrapper:

```bash
sudo bash ./deploy/ubuntu24-host-install.sh
```

## Reconfigure

Ask the same questions again with current values prefilled:

```bash
sudo bash ./deploy/install.sh --reconfigure
```

## Configuration flow

Main prompts:

- `panel_public_host`
- `panel_public_port` (default: `8443`)
- `panel_acme_email`
- `hy2_domain`
- `hy2_port` (default: `443`)
- `mtproxy_public_host`
- `mtproxy_port` (default: `443`)
- `mtproxy_tls_domain`
- `initial_admin_email`
- `initial_admin_password` (blank => generated)

Everything else is generated automatically by installer logic.

## TLS flow

- Caddy issues ACME certificates for the panel domain and the Hysteria domain.
- After Caddy has issued the Hysteria certificate, `scripts/sync-hysteria-cert.sh` copies the resulting `cert/key` into `/etc/proxy-panel/hysteria/`.
- Hysteria runs in plain `tls cert/key` mode and no longer performs ACME on its own.

## Generated runtime env

Main runtime env:

- `/opt/proxy-panel/.env.generated`

Credentials output:

- `/root/proxy-panel-initial-admin.txt`

## Post-install verification

```bash
sudo bash ./deploy/verify.sh
```

This checks service status, API health/readiness, and admin login flow.

## Install phases

1. Ubuntu 24.04 + root checks
2. Package installation (host/system packages)
3. Go/Node install
4. Hysteria + MTProxy install
5. User/group and directory setup
6. Source sync to `/opt/proxy-panel/current`
7. Interactive configuration + env generation
8. PostgreSQL setup
9. Backend/frontend build
10. Runtime config rendering
11. Sudoers + systemd install
12. DB migrations + admin bootstrap
13. Start panel services, MTProxy, Prometheus, and Caddy
14. Wait for and sync the Hysteria certificate from Caddy
15. Start Hysteria + smoke checks