#!/usr/bin/env node
/**
 * Sync zone.home + supermarket zones from Home Assistant into zone-coords.json.
 *
 *   HA_URL=http://192.168.1.61:8123 HA_TOKEN=xxx node homelab/sync-zone-coords-from-ha.mjs
 *   HA_ZONES=zone.home,zone.auchan  (optional, default below)
 */
import {
  fetchZoneCoordsFromHa,
  loadZoneCoords,
  saveZoneCoords,
  zoneCoordsPath,
} from './zone-coords.mjs'

const haUrl = process.env.HA_URL
const haToken = process.env.HA_TOKEN
const zoneIds = (process.env.HA_ZONES || 'zone.home,zone.auchan')
  .split(',')
  .map((z) => z.trim())
  .filter(Boolean)

if (!haUrl || !haToken) {
  console.error('Set HA_URL and HA_TOKEN')
  process.exit(1)
}

const config = loadZoneCoords()
const fetched = await fetchZoneCoordsFromHa(haUrl, haToken, zoneIds)
config.zones = { ...config.zones, ...fetched }
saveZoneCoords(config)
console.log(`Wrote ${Object.keys(fetched).length} zone(s) to ${zoneCoordsPath()}`)
for (const [id, z] of Object.entries(fetched)) {
  console.log(`  ${id}: ${z.latitude}, ${z.longitude}`)
}
