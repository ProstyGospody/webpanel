# Operations

## Service status

```bash
systemctl status proxy-panel-api proxy-panel-web hysteria-server mtproxy caddy
```

## Restart services

```bash
systemctl restart proxy-panel-api
systemctl restart proxy-panel-web
systemctl restart hysteria-server
systemctl restart mtproxy
systemctl restart caddy
```

## Logs

```bash
journalctl -u proxy-panel-api -n 200 --no-pager
journalctl -u proxy-panel-web -n 200 --no-pager
journalctl -u hysteria-server -n 200 --no-pager
journalctl -u mtproxy -n 200 --no-pager
```

## Important paths

- File-backed state: `/var/lib/proxy-panel/state/`
- Snapshots/backups: `/var/lib/proxy-panel/snapshots/`, `/var/lib/proxy-panel/backups/`
- Audit records: `/var/log/proxy-panel/audit/`
- MTProxy active secret: `/etc/proxy-panel/mtproxy/active-secret.txt`
- MTProxy assets: `/var/lib/mtproxy/proxy-secret`, `/var/lib/mtproxy/proxy-multi.conf`
- Hysteria config: `/etc/proxy-panel/hysteria/server.yaml`
- Generated env: `/opt/proxy-panel/.env.generated`

## Refresh MTProxy assets

```bash
sudo bash /opt/proxy-panel/current/scripts/update-mtproxy-assets.sh /opt/proxy-panel/.env.generated
sudo systemctl restart mtproxy
```

## Hysteria certificate resync

```bash
sudo bash /opt/proxy-panel/current/scripts/sync-hysteria-cert.sh /opt/proxy-panel/.env.generated
sudo systemctl restart hysteria-server
```

## Full smoke check

```bash
sudo bash /opt/proxy-panel/current/scripts/smoke-check.sh /opt/proxy-panel/.env.generated
```
