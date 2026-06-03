#!/usr/bin/env bash
# Deploy Nourish smart-shopping to Home Assistant OS (VM 106) via Proxmox guest exec.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PVE_HOST="${PVE_HOST:-root@192.168.1.3}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/pve_ed25519}"
HA_VMID="${HA_VMID:-106}"
HA_TOKEN="${HA_TOKEN:?Set HA_TOKEN (long-lived access token)}"

export SSH_KEY PVE_HOST HA_VMID HA_TOKEN ROOT

python3 <<'PY'
import json, subprocess, base64, os

SSH = os.environ["SSH_KEY"]
PVE = os.environ["PVE_HOST"]
VMID = os.environ["HA_VMID"]

def guest(cmd: str) -> str:
    r = subprocess.run(
        ["ssh", "-i", SSH, "-o", "StrictHostKeyChecking=no", PVE, f"qm guest exec {VMID} --"] + cmd.split(),
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(r.stdout)
    if data.get("exitcode", 0) != 0:
        raise SystemExit(data.get("err-data") or data)
    return data["out-data"]

def guest_write(path: str, content: str) -> None:
    b64 = base64.b64encode(content.encode()).decode()
    subprocess.run(
        ["ssh", "-i", SSH, "-o", "StrictHostKeyChecking=no", PVE,
         f"qm guest exec {VMID} -- sh -c \"echo {b64} | base64 -d > {path}\""],
        check=True,
    )

# Package file (optional duplicate; main config is patched below)
guest("mkdir -p /mnt/data/supervisor/homeassistant/packages")
pkg_path = os.path.join(os.environ["ROOT"], "homelab/ha-packages/nourish_smart_shopping.yaml")
with open(pkg_path) as f:
    guest_write("/mnt/data/supervisor/homeassistant/packages/nourish_smart_shopping.yaml", f.read())
guest("rm -f /mnt/data/supervisor/homeassistant/packages/nourish-smart-shopping.yaml /mnt/data/supervisor/homeassistant/packages/nourish-supermarket-metrics.yaml /mnt/data/supervisor/homeassistant/packages/nourish_supermarket_metrics.yaml")

cfg = guest("cat /mnt/data/supervisor/homeassistant/configuration.yaml")
if "include_dir_named packages" not in cfg:
    cfg = cfg.rstrip() + "\n\nhomeassistant:\n  packages: !include_dir_named packages\n"
if "nourish_despensa_check" not in cfg:
    block = """  nourish_despensa_check:
    url: "http://192.168.1.24:5678/webhook/nourish-leave-home"
    method: POST
    content_type: "application/json"
    payload: '{"days_until_shop": {{ states("input_number.nourish_days_until_shop") | float(default=4) }}}'
    timeout: 120
"""
    cfg = cfg.replace("  ntfy_laundry:", block + "  ntfy_laundry:")
if "input_number:" not in cfg:
    cfg = cfg.rstrip() + """
input_number:
  nourish_days_until_shop:
    name: Dias ate ao supermercado
    min: 1
    max: 21
    step: 0.5
    unit_of_measurement: days
    icon: mdi:cart-outline
    initial: 4
"""
guest_write("/mnt/data/supervisor/homeassistant/configuration.yaml", cfg)

import yaml

autos = yaml.safe_load(guest("cat /mnt/data/supervisor/homeassistant/automations.yaml"))
for a in autos:
    if a.get("id") == "francisco_sai_de_casa":
        acts = [
            {
                "action": "notify.send_message",
                "target": {"entity_id": "notify.presence"},
                "data": {
                    "title": "{{ trigger.to_state.attributes.friendly_name }} saiu de casa",
                    "message": "{{ trigger.to_state.attributes.friendly_name }} saiu de casa",
                },
            },
            {"action": "rest_command.nourish_event_leave_home"},
            {"action": "rest_command.nourish_despensa_check"},
        ]
        a["actions"] = acts
        break
else:
    raise SystemExit("automation francisco_sai_de_casa not found")
guest_write("/mnt/data/supervisor/homeassistant/automations.yaml", yaml.dump(autos, allow_unicode=True, sort_keys=False))
print("HA config written")
PY

curl -sf -X POST "http://192.168.1.61:8123/api/services/homeassistant/restart" \
  -H "Authorization: Bearer $HA_TOKEN" -H "Content-Type: application/json" -d '{}' \
  && echo "HA restart triggered (wait ~60s before testing)."

echo "Test: rest_command.nourish_despensa_check or leave home (person.francisco_fernandes)."
