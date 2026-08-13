/**
 * Tracked supermarkets + blocklist for discovery prompts.
 * Persisted in NOURISH_DATA_DIR/supermarkets.json
 */

import fs from 'fs'
import path from 'path'
import { loadZoneCoords, saveZoneCoords } from './zone-coords.mjs'
import {
  setupHaSupermarketZone,
  fireSupermarketEvent,
  ensureHaZonesForTracked,
  DEFAULT_ZONE_RADIUS_M,
} from './ha-supermarket-zone.mjs'

const DATA_DIR = process.env.NOURISH_DATA_DIR || '/opt/nourish/data'
const FILE = process.env.NOURISH_SUPERMARKETS_FILE || path.join(DATA_DIR, 'supermarkets.json')

/** @typedef {{ id: string, name: string, place_key: string, zone_id?: string, latitude?: number, longitude?: number, added_at: string }} TrackedSupermarket */
/** @typedef {{ place_key: string, name: string, blocked_at: string }} BlockedPlace */

const DEFAULT_DATA = {
  tracked: [
    {
      id: 'auchan',
      name: 'Auchan',
      place_key: 'auchan',
      zone_id: 'zone.auchan',
      added_at: new Date(0).toISOString(),
    },
  ],
  blocklist: [],
}

export function normalizePlaceKey(place) {
  return String(place || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function loadSupermarkets(readFile = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null)) {
  const raw = readFile(FILE)
  if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA))
  try {
    const parsed = JSON.parse(raw)
    return {
      tracked: Array.isArray(parsed.tracked) ? parsed.tracked : DEFAULT_DATA.tracked,
      blocklist: Array.isArray(parsed.blocklist) ? parsed.blocklist : [],
    }
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DATA))
  }
}

export function saveSupermarkets(data, writeFile = (p, content) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, content)
}) {
  writeFile(FILE, JSON.stringify(data, null, 2))
}

function placeMatchesTracked(placeKey, tracked) {
  return tracked.some(
    (t) =>
      t.place_key === placeKey ||
      placeKey.includes(t.place_key) ||
      t.place_key.includes(placeKey)
  )
}

function placeMatchesBlocked(placeKey, blocklist) {
  return blocklist.some(
    (b) =>
      b.place_key === placeKey ||
      placeKey.includes(b.place_key) ||
      b.place_key.includes(placeKey) ||
      String(b.name || '').toLowerCase().includes(placeKey.replace(/_/g, ' '))
  )
}

/**
 * @param {string} place
 * @param {TrackedSupermarket[]} tracked
 * @param {BlockedPlace[]} blocklist
 */
export function shouldPromptForPlace(place, tracked, blocklist) {
  const key = normalizePlaceKey(place)
  if (!key) return { prompt: false, reason: 'empty' }
  if (placeMatchesTracked(key, tracked)) return { prompt: false, reason: 'tracked' }
  if (placeMatchesBlocked(key, blocklist)) return { prompt: false, reason: 'blocked' }
  return { prompt: true, place_key: key }
}

/**
 * @param {{ place: string, latitude?: number, longitude?: number, zone_id?: string, radius?: number, create_ha_zone?: boolean, register_visit?: boolean }} input
 */
export async function trackSupermarket(input) {
  const data = loadSupermarkets()
  const placeKey = normalizePlaceKey(input.place)
  const name = String(input.place || placeKey).trim()
  const zoneId = input.zone_id || `zone.${placeKey}`
  const lat = Number(input.latitude)
  const lon = Number(input.longitude)
  const radius = Number(input.radius) > 0 ? Number(input.radius) : DEFAULT_ZONE_RADIUS_M

  const already = placeMatchesTracked(placeKey, data.tracked)
  let entry = data.tracked.find(
    (t) => t.place_key === placeKey || placeKey.includes(t.place_key) || t.place_key.includes(placeKey)
  )

  if (!already) {
    data.blocklist = data.blocklist.filter((b) => b.place_key !== placeKey)
    entry = {
      id: placeKey,
      name,
      place_key: placeKey,
      zone_id: zoneId,
      added_at: new Date().toISOString(),
      radius,
      ...(Number.isFinite(lat) && Number.isFinite(lon) ? { latitude: lat, longitude: lon } : {}),
    }
    data.tracked.push(entry)
    saveSupermarkets(data)
  } else if (entry && Number.isFinite(lat) && Number.isFinite(lon)) {
    // Refresh coords/radius if the client sent a better fix while re-tracking.
    entry.latitude = lat
    entry.longitude = lon
    entry.radius = radius
    entry.zone_id = entry.zone_id || zoneId
    saveSupermarkets(data)
  }

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const zones = loadZoneCoords()
    const zid = entry?.zone_id || zoneId
    zones.zones[zid] = { latitude: lat, longitude: lon, name: entry?.name || name }
    saveZoneCoords(zones)
  }

  let haSetup = null
  const haUrl = process.env.HA_URL
  const haToken = process.env.HA_TOKEN
  const useLat = Number.isFinite(lat) ? lat : Number(entry?.latitude)
  const useLon = Number.isFinite(lon) ? lon : Number(entry?.longitude)
  if (input.create_ha_zone !== false && haUrl && haToken && Number.isFinite(useLat) && Number.isFinite(useLon)) {
    try {
      haSetup = await setupHaSupermarketZone(haUrl, haToken, {
        name: entry?.name || name,
        placeKey: entry?.place_key || placeKey,
        latitude: useLat,
        longitude: useLon,
        radius: Number(entry?.radius) > 0 ? Number(entry.radius) : radius,
      })
      if (haSetup?.zone_id && entry && entry.zone_id !== haSetup.zone_id) {
        entry.zone_id = haSetup.zone_id
        saveSupermarkets(data)
      }
      // Only open a visit when the client confirms the user is at the store now
      // (Estou aqui + Acompanhar). Remote "Acompanhar" must not invent an ida.
      if (input.register_visit) {
        await fireSupermarketEvent(haSetup.zone_id || zoneId, 'supermarket_enter')
      }
    } catch (e) {
      haSetup = { error: e.message }
    }
  } else if (input.create_ha_zone !== false && (!haUrl || !haToken)) {
    haSetup = { error: 'HA_URL and HA_TOKEN not set on nourish server — zone not created in HA' }
  }

  return { ok: true, already, entry, data, ha_setup: haSetup }
}

/** Push all tracked stores with coords into HA (zones + enter/leave). */
export async function syncTrackedSupermarketsToHa() {
  const haUrl = process.env.HA_URL
  const haToken = process.env.HA_TOKEN
  if (!haUrl || !haToken) {
    return { ok: false, error: 'HA_URL and HA_TOKEN required' }
  }
  const data = loadSupermarkets()
  const results = await ensureHaZonesForTracked(haUrl, haToken, data.tracked)
  // Keep zone_id in sync with what HA actually created.
  let changed = false
  for (const r of results) {
    if (!r.ok || !r.zone_id) continue
    const t = data.tracked.find((x) => x.place_key === r.place_key)
    if (t && t.zone_id !== r.zone_id) {
      t.zone_id = r.zone_id
      changed = true
    }
  }
  if (changed) saveSupermarkets(data)
  return { ok: true, results }
}

export function blockSupermarket(place) {
  const data = loadSupermarkets()
  const placeKey = normalizePlaceKey(place)
  const name = String(place || placeKey).trim()

  if (!placeMatchesBlocked(placeKey, data.blocklist)) {
    data.blocklist.push({ place_key: placeKey, name, blocked_at: new Date().toISOString() })
  }
  data.tracked = data.tracked.filter((t) => t.place_key !== placeKey)
  saveSupermarkets(data)
  return { ok: true, data }
}

export function unblockSupermarket(placeKey) {
  const data = loadSupermarkets()
  const key = normalizePlaceKey(placeKey)
  data.blocklist = data.blocklist.filter((b) => b.place_key !== key)
  saveSupermarkets(data)
  return { ok: true, data }
}

export function removeTrackedSupermarket(placeKey) {
  const data = loadSupermarkets()
  const key = normalizePlaceKey(placeKey)
  data.tracked = data.tracked.filter((t) => t.place_key !== key)
  saveSupermarkets(data)
  return { ok: true, data }
}
