# Deploy

## Requirements

- Clean Ubuntu 24.04 LTS server
- Root access (or sudo)
- DNS records prepared for panel/Hysteria domains
- Ports open:
  - SSH (`22/tcp`)
  - Panel (`8443/tcp` by default)
  - Hysteria (`443/udp`)
  - MTProxy (`443/tcp`)

## One-command install

```bash
sudo bash ./deploy/ubuntu24-host-install.sh
```

First run creates `deploy/ansible/group_vars/all.yml` from `all.yml.example` and exits.
Fill values and rerun the same command.

## Reconfigure

Update `deploy/ansible/group_vars/all.yml` and rerun:

```bash
sudo bash ./deploy/ubuntu24-host-install.sh
```

## Configuration

Deployment values come from `deploy/ansible/group_vars/all.yml`.

Main vars:

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
7. Env generation
8. PostgreSQL setup
9. Backend/frontend build
10. Runtime config rendering
11. Sudoers + systemd install
12. DB migrations + admin bootstrap
13. Service start + smoke checks
