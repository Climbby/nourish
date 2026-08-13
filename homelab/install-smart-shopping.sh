#!/usr/bin/env bash
# Run from your machine: ./homelab/install-smart-shopping.sh
# Requires: SSH to Proxmox (pve_ed25519), nourish .env with GROCY_API_KEY

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PVE_HOST="${PVE_HOST:-root@192.168.1.3}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/pve_ed25519}"
CT_NOURISH="${CT_NOURISH:-117}"

ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- mkdir -p /opt/nourish /etc/nourish"

tar czf - -C "$ROOT/scripts" grocy-despensa-check.mjs shopping-list-summary.mjs | \
  ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- tar xzf - -C /opt/nourish"

GROCY_API_KEY=$(grep '^GROCY_API_KEY=' "$ROOT/.env" | cut -d= -f2-)
GROCY_HOST=$(grep '^GROCY_HOST=' "$ROOT/.env" | cut -d= -f2- || echo '192.168.1.61:9192')
[ -z "${GROCY_HOST:-}" ] && GROCY_HOST='192.168.1.61:9192'

# Optional: long-lived HA token so "Acompanhar" creates GPS zones + enter/leave automations.
# Prefer shell env; fall back to nourish/.env keys HA_URL / HA_TOKEN / LIFEOS_HA_*.
HA_URL="${HA_URL:-}"
HA_TOKEN="${HA_TOKEN:-}"
if [ -z "$HA_URL" ]; then
  HA_URL="$(grep -E '^(HA_URL|LIFEOS_HA_URL)=' "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)"
fi
if [ -z "$HA_TOKEN" ]; then
  HA_TOKEN="$(grep -E '^(HA_TOKEN|LIFEOS_HA_TOKEN)=' "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)"
fi
HA_URL="${HA_URL:-http://192.168.1.61:8123}"

ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- tee /etc/nourish/env > /dev/null" <<EOF
GROCY_HOST=$GROCY_HOST
GROCY_API_KEY=$GROCY_API_KEY
DESPENSA_GROUP_ID=6
DAYS_UNTIL_SHOP=4
HA_URL=$HA_URL
HA_TOKEN=$HA_TOKEN
HA_DEVICE_TRACKER=device_tracker.telemovel_francisco
HA_PERSON_ENTITY=person.francisco_fernandes
EOF

ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- chmod 600 /etc/nourish/env"

ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- tee /opt/nourish/check.sh > /dev/null" <<'EOF'
#!/bin/bash
set -a
# shellcheck source=/dev/null
source /etc/nourish/env
set +a
export DAYS_UNTIL_SHOP="${1:-${DAYS_UNTIL_SHOP:-}}"
exec /usr/bin/node /opt/nourish/grocy-despensa-check.mjs
EOF

ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- chmod +x /opt/nourish/check.sh"

echo "Testing check on CT$CT_NOURISH..."
ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- /opt/nourish/check.sh" | head -20

# HTTP API for n8n (port 8787 on nourish CT)
tar czf - -C "$ROOT/homelab" \
  nourish-check-server.mjs \
  supermarket-visits.mjs \
  fuel-prices.mjs \
  trip-distance.mjs \
  zone-coords.mjs \
  supermarkets.mjs \
  ha-supermarket-zone.mjs \
  ha-ws-lite.mjs \
  zone-coords.example.json \
  nourish-check.service 2>/dev/null | \
  ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- tar xzf - -C /opt/nourish" 2>/dev/null || true
ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- bash -c '
  cp /opt/nourish/nourish-check.service /etc/systemd/system/nourish-check.service
  cp /opt/nourish/nourish-check-server.mjs /opt/nourish/check-server.mjs
  cp /opt/nourish/supermarket-visits.mjs /opt/nourish/supermarket-visits.mjs
  cp /opt/nourish/fuel-prices.mjs /opt/nourish/fuel-prices.mjs
  cp /opt/nourish/trip-distance.mjs /opt/nourish/trip-distance.mjs
  cp /opt/nourish/zone-coords.mjs /opt/nourish/zone-coords.mjs
  cp /opt/nourish/supermarkets.mjs /opt/nourish/supermarkets.mjs
  cp /opt/nourish/ha-supermarket-zone.mjs /opt/nourish/ha-supermarket-zone.mjs
  cp /opt/nourish/ha-ws-lite.mjs /opt/nourish/ha-ws-lite.mjs
  mkdir -p /opt/nourish/data
  if [ ! -f /opt/nourish/data/zone-coords.json ]; then
    cp /opt/nourish/zone-coords.example.json /opt/nourish/data/zone-coords.json
  fi
  systemctl daemon-reload
  systemctl enable nourish-check
  systemctl restart nourish-check
'"

if [ -n "${HA_TOKEN:-}" ]; then
  echo "Waiting for API, then ensuring HA zones for tracked stores..."
  sleep 2
  curl -sf -X POST "http://192.168.1.27:8787/supermarkets/ensure-ha-zones" | head -c 2000 || \
    echo "WARN: ensure-ha-zones failed — check HA_TOKEN and that rest_command.nourish_event_supermarket_zone exists"
else
  echo "WARN: HA_TOKEN not set — tracked stores will NOT get HA GPS zones until you add HA_TOKEN to .env and re-run."
fi

echo "Done. n8n workflow should call http://192.168.1.27:8787/check — add HA package (docs/homelab-smart-shopping.md)."
