/**
 * Zone coordinates for home ↔ supermarket driving distance.
 * Stored in NOURISH_DATA_DIR/zone-coords.json — copy from zone-coords.example.json.
 */

import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.NOURISH_DATA_DIR || '/opt/nourish/data'
const ZONE_COORDS_FILE = process.env.NOURISH_ZONE_COORDS_FILE || path.join(DATA_DIR, 'zone-coords.json')

/** @typedef {{ latitude: number, longitude: number, name?: string }} ZoneCoord */
/** @typedef {{ home_zone: string, default_supermarket_zone?: string, zones: Record<string, ZoneCoord> }} ZoneCoordsConfig */

const DEFAULT_CONFIG = {
  home_zone: 'zone.home',
  default_supermarket_zone: 'zone.auchan',
  zones: {},
}

export function zoneCoordsPath() {
  return ZONE_COORDS_FILE
}

export function loadZoneCoords(readFile = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null)) {
  const raw = readFile(ZONE_COORDS_FILE)
  if (!raw) return { ...DEFAULT_CONFIG, zones: { ...DEFAULT_CONFIG.zones } }
  try {
    const parsed = JSON.parse(raw)
    return {
      home_zone: parsed.home_zone || DEFAULT_CONFIG.home_zone,
      default_supermarket_zone:
        parsed.default_supermarket_zone || DEFAULT_CONFIG.default_supermarket_zone,
      zones: parsed.zones && typeof parsed.zones === 'object' ? parsed.zones : {},
    }
  } catch {
    return { ...DEFAULT_CONFIG, zones: { ...DEFAULT_CONFIG.zones } }
  }
}

export function saveZoneCoords(config, writeFile = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, data)
}) {
  writeFile(ZONE_COORDS_FILE, JSON.stringify(config, null, 2))
}

/** @param {ZoneCoordsConfig} config */
export function getZoneCoord(config, zoneId) {
  const z = config.zones?.[zoneId]
  if (!z) return null
  const lat = Number(z.latitude)
  const lon = Number(z.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { latitude: lat, longitude: lon, name: z.name }
}

/**
 * Fetch zone lat/lon from Home Assistant states API.
 * @param {string} haUrl e.g. http://192.168.1.61:8123
 * @param {string} haToken long-lived token
 * @param {string[]} zoneIds e.g. ['zone.home', 'zone.auchan']
 */
export async function fetchZoneCoordsFromHa(haUrl, haToken, zoneIds) {
  const base = haUrl.replace(/\/$/, '')
  const zones = {}
  for (const zoneId of zoneIds) {
    const res = await fetch(`${base}/api/states/${encodeURIComponent(zoneId)}`, {
      headers: { Authorization: `Bearer ${haToken}`, Accept: 'application/json' },
    })
    if (!res.ok) continue
    const state = await res.json()
    const lat = Number(state.attributes?.latitude)
    const lon = Number(state.attributes?.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    zones[zoneId] = {
      latitude: lat,
      longitude: lon,
      name: state.attributes?.friendly_name || zoneId,
    }
  }
  return zones
}
