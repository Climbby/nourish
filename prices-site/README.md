# Supermercados Portugal (Nourish Preços)

Website read-only de preços por supermercado, alimentado pelos talões do Nourish.

## Dev

```bash
cd prices-site
cp .env.example .env   # opcional — aponta NOURISH_API_HOST para o CT117
npm install
npm run dev            # http://localhost:5174
```

A API usada é a mesma do Nourish: `GET/POST /nourish/store-prices` no homelab (`homelab/store-prices.mjs`).

## Produção (CT117 Nourish)

Folded from retired CT125 onto the Nourish LXC.

| | |
|--|--|
| LXC | CT117 `nourish` |
| IPs | `192.168.1.27` (Nourish) · `192.168.1.127` (alias for Cloudflare tunnel) |
| Ficheiros | `/var/www/prices/` |
| Nginx | `sites-available/prices.conf` (`server_name supermercados-portugal.guessitgame.me`) |
| API | proxy `/nourish/` → `127.0.0.1:8787` |

### URL

- LAN: http://192.168.1.127/ (Host `supermercados-portugal.guessitgame.me`) or via tunnel
- Público: https://supermercados-portugal.guessitgame.me  
  (tunnel → `http://192.168.1.127:80` — ver `cloudflare-tunnel.md`)

### Redeploy

```bash
cd prices-site && npm run build
# via Proxmox: tar dist → pct push CT117 → /var/www/prices + nginx reload
```
