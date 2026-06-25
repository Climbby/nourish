#!/usr/bin/env bash
# Deploy Nourish + homelab monitoring packages to Home Assistant OS (VM 106).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PVE_HOST="${PVE_HOST:-root@192.168.1.3}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/pve_ed25519}"
HA_VMID="${HA_VMID:-106}"
HA_TOKEN="${HA_TOKEN:?Set HA_TOKEN (long-lived access token)}"

export SSH_KEY PVE_HOST HA_VMID HA_TOKEN ROOT

python3 <<'PY'
import json, subprocess, os, sys

SSH = os.environ["SSH_KEY"]
PVE = os.environ["PVE_HOST"]
VMID = os.environ["HA_VMID"]
ROOT = os.environ["ROOT"]

PKG_DIR = os.path.join(ROOT, "homelab/ha-packages")
PACKAGE_FILES = sorted(
    f for f in os.listdir(PKG_DIR) if f.endswith(".yaml") and not f.endswith(".example.yaml")
)


def guest(cmd: str, stdin: str | None = None) -> str:
    r = subprocess.run(
        ["ssh", "-i", SSH, "-o", "StrictHostKeyChecking=no", PVE, f"qm guest exec {VMID} -- {cmd}"],
        input=stdin,
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(r.stdout)
    if data.get("exitcode", 0) != 0:
        raise SystemExit(data.get("err-data") or data)
    return data.get("out-data") or ""


def guest_write(path: str, content: str) -> None:
    import base64

    guest(f"rm -f {path}")
    raw = content.encode()
    chunk_size = 480
    for i in range(0, len(raw), chunk_size):
        chunk_b64 = base64.b64encode(raw[i : i + chunk_size]).decode()
        r = subprocess.run(
            [
                "ssh",
                "-i",
                SSH,
                "-o",
                "StrictHostKeyChecking=no",
                PVE,
                f"qm guest exec {VMID} -- sh -c \"echo {chunk_b64} | base64 -d >> {path}\"",
            ],
            capture_output=True,
            text=True,
        )
        if r.returncode != 0:
            raise SystemExit(f"guest_write chunk failed for {path}: {r.stderr or r.stdout}")


guest("mkdir -p /mnt/data/supervisor/homeassistant/packages")
for pkg_name in PACKAGE_FILES:
    with open(os.path.join(PKG_DIR, pkg_name)) as f:
        content = f.read()
    guest_write(f"/mnt/data/supervisor/homeassistant/packages/{pkg_name}", content)
    print(f"deployed package {pkg_name} ({len(content)} bytes)")

# Remove legacy duplicate package names
for legacy in (
    "nourish-smart-shopping.yaml",
    "nourish-supermarket-metrics.yaml",
    "nourish_supermarket_metrics.yaml",
    # Redundant with the UI Template helper of the same name (which the
    # leave-home automations use); removed to drop the duplicate _2 entity.
    "nourish_wifi_presence.yaml",
):
    guest(f"rm -f /mnt/data/supervisor/homeassistant/packages/{legacy}")

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
    if "  ntfy_laundry:" in cfg:
        cfg = cfg.replace("  ntfy_laundry:", block + "  ntfy_laundry:")
    else:
        cfg = cfg.rstrip() + "\nrest_command:\n" + block
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

autos = yaml.safe_load(guest("cat /mnt/data/supervisor/homeassistant/automations.yaml")) or []

leave_home_triggers = [
    {"trigger": "zone", "entity_id": "person.francisco_fernandes", "zone": "zone.home", "event": "leave"},
    {"trigger": "state", "entity_id": "binary_sensor.francisco_em_wifi_de_casa", "from": "on", "to": "off", "for": {"seconds": 45}},
    {"trigger": "state", "entity_id": "person.francisco_fernandes", "from": "home"},
]
leave_home_actions = [
    {
        "action": "notify.send_message",
        "target": {"entity_id": "notify.presence"},
        "data": {
            "title": "{{ state_attr('person.francisco_fernandes', 'friendly_name') | default('Francisco') }} saiu de casa",
            "message": "{{ state_attr('person.francisco_fernandes', 'friendly_name') | default('Francisco') }} saiu de casa",
        },
    },
    {"action": "rest_command.nourish_event_leave_home"},
    {"action": "rest_command.nourish_despensa_check"},
]

arrive_home_triggers = [
    {"trigger": "state", "entity_id": "person.francisco_fernandes", "to": "home"},
    {"trigger": "zone", "entity_id": "person.francisco_fernandes", "zone": "zone.home", "event": "enter"},
    # `for` debounces the 1-3s `<not connected>` blip the Wi-Fi sensor emits while
    # roaming between home APs/bands (router / 5GHz / extender); without it every
    # roam flipped this off->on and fired a spurious "chegou a casa". `id: wifi`
    # lets the condition below suppress the case where the person never left.
    {"trigger": "state", "entity_id": "binary_sensor.francisco_em_wifi_de_casa", "from": "off", "to": "on", "for": {"seconds": 45}, "id": "wifi"},
]
# Only fire on a genuine arrival: the Wi-Fi trigger is ignored if the person is
# already 'home' (i.e. an intra-home roam, not a real return). The person/zone
# triggers (no id) always pass.
arrive_home_conditions = [
    {
        "condition": "template",
        "value_template": "{{ trigger.id != 'wifi' or not is_state('person.francisco_fernandes', 'home') }}",
    },
]
arrive_home_actions = [
    {
        "action": "notify.send_message",
        "target": {"entity_id": "notify.presence"},
        "data": {
            "title": "{{ state_attr('person.francisco_fernandes', 'friendly_name') | default('Francisco') }} chegou a casa",
            "message": "{{ state_attr('person.francisco_fernandes', 'friendly_name') | default('Francisco') }} chegou a casa",
        },
    },
]


def patch_automation(autos, automation_id, triggers, actions, conditions=None):
    for a in autos:
        if a.get("id") != automation_id:
            continue
        new_style = "triggers" in a or any("trigger" in k for k in a)
        if new_style:
            a["triggers"] = triggers
            a["conditions"] = conditions or []
            a["actions"] = actions
        else:
            a["trigger"] = triggers
            a["condition"] = conditions or []
            a["action"] = actions
        a["mode"] = "single"
        a["description"] = a.get("description") or automation_id
        return True
    return False


if not patch_automation(autos, "francisco_sai_de_casa", leave_home_triggers, leave_home_actions):
    sys.exit("automation francisco_sai_de_casa not found")
if not patch_automation(autos, "francisco_chega_a_casa", arrive_home_triggers, arrive_home_actions, arrive_home_conditions):
    sys.exit("automation francisco_chega_a_casa not found")

guest_write("/mnt/data/supervisor/homeassistant/automations.yaml", yaml.dump(autos, allow_unicode=True, sort_keys=False))
print("HA config written")
PY

# reload_all picks up package/automation YAML without a full restart: it runs a
# config check first (aborts safely on error) and returns a real success/failure,
# unlike homeassistant/restart, which drops the HTTP connection mid-restart and
# false-negatives even when it worked.
# NOTE: the first time the `packages:` include is added to configuration.yaml a
# one-time full restart is still needed; subsequent deploys reload cleanly.
HA_API="${HA_API:-http://192.168.1.61:8123}"
if curl -sf -X POST "$HA_API/api/services/homeassistant/reload_all" \
    -H "Authorization: Bearer $HA_TOKEN" -H "Content-Type: application/json" -d '{}' >/dev/null; then
  echo "HA config reloaded — packages + automations are live now."
else
  echo "WARN: reload_all failed — check HA_TOKEN/connectivity, or reload manually:"
  echo "      Developer Tools → YAML → All YAML configuration."
fi

echo ""
echo "Deployed packages:"
echo "  homelab_health, homelab_alerts, homelab_nourish_metrics, homelab_proxmox"
echo "  nourish_smart_shopping, nourish_high_accuracy_gps, nourish_supermarket_discovery"
echo ""
echo "Next: import homelab/n8n/nourish-sync-shop-interval-import.json into n8n (CT114)."
echo "Restart guessit-bot on CT120 after deploying bot health endpoint (:8090/health)."
