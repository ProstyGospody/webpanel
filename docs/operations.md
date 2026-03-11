# Operations

## Service management

Status:

```bash
systemctl status proxy-panel-api proxy-panel-web hysteria-server mtproxy caddy
```

Restart:

```bash
systemctl restart proxy-panel-api
systemctl restart proxy-panel-web
systemctl restart hysteria-server
systemctl restart mtproxy
```

Logs:

```bash
journalctl -u proxy-panel-api -n 200 --no-pager
journalctl -u proxy-panel-web -n 200 --no-pager
journalctl -u hysteria-server -n 200 --no-pager
journalctl -u mtproxy -n 200 --no-pager
```

## Runtime files

- App source: `/opt/proxy-panel/current`
- API binary: `/opt/proxy-panel/bin/panel-api`
- Env: `/opt/proxy-panel/.env.generated`
- Hysteria config: `/etc/proxy-panel/hysteria/server.yaml`
- MTProxy config: `/etc/proxy-panel/mtproxy/runtime.env`
- MTProxy secrets list: `/etc/proxy-panel/mtproxy/secrets.list`

## DB migrations

```bash
set -a; source /opt/proxy-panel/.env.generated; set +a
/opt/proxy-panel/bin/panel-api migrate
```

## Admin bootstrap/reset

```bash
set -a; source /opt/proxy-panel/.env.generated; set +a
/opt/proxy-panel/bin/panel-api bootstrap-admin --email "admin@example.com" --password "new_password"
```

## Re-deploy after update

```bash
cd /path/to/repo
sudo bash ./deploy/ubuntu24-host-install.sh
```

## Smoke checks

```bash
sudo bash ./deploy/verify.sh
```

## Rollback (basic)

1. Restore previous `/opt/proxy-panel/current` snapshot from backup.
2. Restart services:

```bash
systemctl restart proxy-panel-api proxy-panel-web hysteria-server mtproxy caddy
```

## Backup recommendations

- PostgreSQL database dump (`pg_dump`)
- `/opt/proxy-panel/.env.generated`
- `/etc/proxy-panel/`
- `/root/proxy-panel-initial-admin.txt`


