# Supermarket zone auto-discovery (Home Assistant)

## Goal

When you visit a supermarket that is not yet tracked, HA sends a phone notification asking whether to save or ignore that place. Saved names go to an allowlist; ignored names go to a denylist.

## Limitations

Home Assistant **cannot create GPS zones automatically** from a notification tap. Zones must still be drawn manually in **Settings → Areas & zones → Zones**, or created via the REST API / `zone.create` service with lat/lon/radius.

This package therefore:

1. Detects likely supermarket visits from **geocoded location** text (Continente, Auchan, Lidl, …).
2. Compares against comma-separated **allow** / **deny** lists in `input_text` helpers.
3. Sends a **mobile notification** with **Guardar** / **Ignorar** actions.
4. On **Guardar**, appends a slug to the allowlist and reminds you to create the zone on the map.

## Files

| File | Purpose |
|------|---------|
| `homelab/ha-packages/nourish_supermarket_discovery.yaml` | HA package (helpers + automations) |
| `homelab/ha-packages/nourish_smart_shopping.yaml` | Existing enter/leave zone automations for known zones |

## Setup

1. Deploy the package (same flow as smart shopping):

   ```bash
   HA_TOKEN=… ./homelab/deploy-ha-smart-shopping.sh
   ```

   Copy `nourish_supermarket_discovery.yaml` into HA packages if not already included by your deploy script.

2. Adjust entity IDs in the YAML:

   - `sensor.francisco_fernandes_geocoded_location` — your person's geocoded sensor
   - `person.francisco_fernandes` — your person entity
   - `notify.mobile_app_francisco` — your mobile app notify service

3. Reload automations / restart HA.

4. When notified, create a zone in the HA map centred on your current location, then wire enter/leave automations like `zone.auchan` in `nourish_smart_shopping.yaml`.

## Allow / deny lists

| Helper | Example |
|--------|---------|
| `input_text.nourish_supermarket_allowlist` | `auchan,continente_gandra` |
| `input_text.nourish_supermarket_denylist` | `Continente Gas Station` |
| `input_text.nourish_supermarket_pending` | Internal — last detected place |

## Future: API zone creation

To fully automate zone creation you would need a script that calls:

```yaml
action: zone.create
data:
  name: "Continente Gandra"
  latitude: "{{ state_attr('device_tracker.francisco_fernandes', 'latitude') }}"
  longitude: "{{ state_attr('device_tracker.francisco_fernandes', 'longitude') }}"
  radius: 120
  icon: mdi:cart
```

Then duplicate the enter/leave `rest_command` actions from `nourish_smart_shopping.yaml` for the new zone entity. This is not shipped yet because radius and naming need manual tuning per store.

## Nourish app integration

Visit receipts and supermarket history are stored separately:

- Visits: HA zone enter/leave → `POST /nourish/event` on CT117
- Receipts: Historial → **Adicionar talão** → `/receipt?visit=…` → `POST /nourish/visit-receipts`

See `docs/homelab-supermarket.md` for the existing Auchan zone flow.
