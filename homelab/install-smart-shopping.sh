#!/usr/bin/env bash
# Run from your machine: ./homelab/install-smart-shopping.sh
# Requires: SSH to Proxmox (pve_ed25519), nourish .env with GROCY_API_KEY

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PVE_HOST="${PVE_HOST:-root@192.168.1.3}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/pve_ed25519}"
CT_NOURISH="${CT_NOURISH:-117}"

ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- mkdir -p /opt/nourish /etc/nourish"

tar czf - -C "$ROOT/scripts" grocy-despensa-check.mjs | \
  ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- tar xzf - -C /opt/nourish"

GROCY_API_KEY=$(grep '^GROCY_API_KEY=' "$ROOT/.env" | cut -d= -f2-)
GROCY_HOST=$(grep '^GROCY_HOST=' "$ROOT/.env" | cut -d= -f2- || echo '192.168.1.61:9192')
[ -z "${GROCY_HOST:-}" ] && GROCY_HOST='192.168.1.61:9192'

ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- tee /etc/nourish/env > /dev/null" <<EOF
GROCY_HOST=$GROCY_HOST
GROCY_API_KEY=$GROCY_API_KEY
DESPENSA_GROUP_ID=6
DAYS_UNTIL_SHOP=4
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
tar czf - -C "$ROOT/homelab" nourish-check-server.mjs nourish-check.service 2>/dev/null | \
  ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- tar xzf - -C /opt/nourish" 2>/dev/null || true
ssh -i "$SSH_KEY" "$PVE_HOST" "pct exec $CT_NOURISH -- bash -c '
  cp /opt/nourish/nourish-check.service /etc/systemd/system/nourish-check.service 2>/dev/null || cp /opt/nourish/check-server.mjs /opt/nourish/check-server.mjs
  test -f /opt/nourish/check-server.mjs || mv /opt/nourish/nourish-check-server.mjs /opt/nourish/check-server.mjs 2>/dev/null || true
  systemctl daemon-reload
  systemctl enable nourish-check
  systemctl restart nourish-check
'"

echo "Done. n8n workflow should call http://192.168.1.27:8787/check — add HA package (docs/homelab-smart-shopping.md)."
