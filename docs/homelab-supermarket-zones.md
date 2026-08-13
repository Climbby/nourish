# Supermarket zone auto-discovery (Home Assistant + Nourish)

## Goal

When you visit a supermarket that is not yet tracked, HA (or the Nourish app) asks whether to save it. On **Acompanhar / track**, Nourish:

1. Saves the store in `supermarkets.json` + `zone-coords.json`
2. Creates a GPS zone in Home Assistant (~130 m)
3. Creates enter/leave automations (device_tracker state → zone friendly name)
4. Fires shopping-list webhook on enter

## Requirements on CT117

`/etc/nourish/env` must include:

```bash
HA_URL=http://192.168.1.61:8123
HA_TOKEN=…   # long-lived access token from HA admin profile
HA_DEVICE_TRACKER=device_tracker.telemovel_francisco
```

Zones are created via the HA **websocket** `zone/create` API (core has no `zone.create` service). CT117 uses a small dependency-free WebSocket client (`ha-ws-lite.mjs`) on Node 18.

Deploy / refresh:

```bash
# from nourish repo — picks HA_TOKEN from env or .env
HA_TOKEN=… ./homelab/install-smart-shopping.sh

# backfill zones for stores already tracked
curl -X POST http://192.168.1.27:8787/supermarkets/ensure-ha-zones
```

On server start, Nourish also runs `ensure-ha-zones` once (disable with `NOURISH_ENSURE_HA_ZONES_ON_START=0`).

## Companion high accuracy

After new zones appear in HA, open the Companion app → Background location → High accuracy → **only when entering zone** and select the new stores (plus Home). Trigger range 400–800 m.

## Files

| File | Purpose |
|------|---------|
| `homelab/ha-supermarket-zone.mjs` | HA zone + automation API helper |
| `homelab/supermarkets.mjs` | track / block + `syncTrackedSupermarketsToHa` |
| `homelab/ha-packages/nourish_supermarket_discovery.yaml` | HA prompt after ~3 min at unknown store |
| `homelab/ha-packages/nourish_smart_shopping.yaml` | rest_commands + legacy Auchan enter/leave |

## Why state triggers (not `platform: zone`)

The Companion GPS `device_tracker` often has no lat/lon attributes, so `platform: zone` never fires. The tracker **state** does flip to the zone friendly name (e.g. `Auchan`, `Continente Bom Dia Condeixa-a-Nova`), which is what the auto-created automations use.
