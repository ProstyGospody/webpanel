# Deploy

## Requirements

- Clean Debian 12 server
- Root access (or sudo)
- DNS records prepared for panel/Hysteria domains
- Ports open:
  - SSH (`22/tcp`)
  - Panel (`8443/tcp` by default)
  - Hysteria (`443/udp`)
  - MTProxy (`443/tcp`)

## One-line install

```bash
sudo bash ./deploy/install.sh
```

## Reconfigure

```bash
sudo bash ./deploy/install.sh --reconfigure
```

Reconfigure mode re-asks interactive values and re-renders runtime config while keeping generated defaults unless changed.

## Interactive prompts

The installer asks for:

- `PANEL_PUBLIC_HOST`
- `PANEL_PUBLIC_PORT` (default: `8443`)
- `PANEL_ACME_EMAIL`
- `HY2_DOMAIN`
- `MTPROXY_PUBLIC_HOST`
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD` (blank => generated)

Everything else is generated automatically.

## Generated runtime env

Main runtime env is written to:

- `/opt/proxy-panel/.env.generated`

Credentials output:

- `/root/proxy-panel-initial-admin.txt`

## Post-install verification

```bash
sudo bash ./deploy/verify.sh
```

This checks service status, API health/readiness, and admin login flow.

## Install script phases

1. OS/root checks
2. Package installation
3. Go/Node install
4. Hysteria + MTProxy install
5. User/group and directory setup
6. Source sync to `/opt/proxy-panel/current`
7. Env generation
8. PostgreSQL setup
9. Backend/frontend build
10. Runtime config rendering
11. Sudoers + systemd install
12. DB migrations + admin bootstrap
13. Service start + smoke checks

