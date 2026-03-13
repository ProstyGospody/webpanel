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

Compatibility wrapper:

```bash
sudo bash ./deploy/ubuntu24-host-install.sh
```

## Reconfigure

```bash
sudo bash ./deploy/install.sh --reconfigure
```

## Install phases

1. Ubuntu 24.04 + root checks
2. Package installation (system packages from Ubuntu repositories)
3. Go install from pinned tarball + Hysteria install from pinned release asset
4. MTProxy build from source
5. User/group and directory setup
6. Source sync to `/opt/proxy-panel/current`
7. Interactive configuration + env generation
8. Backend/frontend build
9. Runtime config rendering
10. MTProxy asset refresh to local disk
11. File-store bootstrap (admin + initial MTProxy secret)
12. Sudoers + systemd install
13. Start panel services, MTProxy, Prometheus, and Caddy
14. Wait for and sync the Hysteria certificate from Caddy
15. Start Hysteria + smoke checks

## Generated runtime env

Main runtime env:

- `/opt/proxy-panel/.env.generated`

Credentials output:

- `/root/proxy-panel-initial-admin.txt`

## Post-install verification

```bash
sudo bash ./deploy/verify.sh
```

This checks service status, API health/readiness, MTProxy listener/stats, and admin login flow.

## MTProxy asset refresh

```bash
sudo bash /opt/proxy-panel/current/scripts/update-mtproxy-assets.sh /opt/proxy-panel/.env.generated
sudo systemctl restart mtproxy
```


