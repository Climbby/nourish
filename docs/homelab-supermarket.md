# Supermarket arrival + visit metrics

## Flow

```mermaid
flowchart LR
  HA[HA zone.auchan enter]
  EV[POST /event supermarket_enter]
  N8N[n8n webhook]
  API[POST /at-supermarket]
  Phone[notify.telemovel_francisco]

  HA --> EV
  HA --> N8N --> API --> N8N --> Phone
```

Leave home also `POST /event` with `leave_home` (for Perfil metrics).

## Endpoints (CT117 :8787, proxied as `/nourish/` on nginx)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/metrics` | Visits per week/month, median days between shops |
| GET | `/supermarket-visits?days=90` | Visit history (enter/leave times, duration) |
| POST | `/event` | `supermarket_enter`, `supermarket_leave`, or `leave_home` |
| POST | `/at-supermarket` | JSON shopping list summary |
| POST | `/check` | Despensa check (existing) |

## Deploy

```bash
./homelab/install-smart-shopping.sh
# redeploy nginx with /nourish/ proxy (from repo nginx.conf)
```

Import n8n workflow `homelab/n8n/nourish-at-supermarket-import.json`.

Supermarket automations live in `homelab/ha-packages/nourish_smart_shopping.yaml` — reload HA packages after deploy.
