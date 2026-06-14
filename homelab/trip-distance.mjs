/**
 * Driving distance via OSRM (Open Source Routing Machine).
 * Round trip = route(home → store) + route(store → home).
 * Falls back to straight-line distance between zone coordinates when OSRM is unavailable.
 */

import { getZoneCoord, loadZoneCoords } from './zone-coords.mjs'

const OSRM_BASE = (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/$/, '')
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** @type {Map<string, { km: number, source: 'osrm' | 'zones', at: number }>} */
const memoryCache = new Map()

function cacheKey(homeZone, destZone) {
  return `${homeZone}→${destZone}`
}

function roundKm(km) {
  return Math.round(km * 10) / 10
}

/**
 * Great-circle distance between two coordinates (km).
 * @param {{ latitude: number, longitude: number }} from
 * @param {{ latitude: number, longitude: number }} to
 */
export function haversineKm(from, to) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(to.latitude - from.latitude)
  const dLon = toRad(to.longitude - from.longitude)
  const lat1 = toRad(from.latitude)
  const lat2 = toRad(to.latitude)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * @param {{ latitude: number, longitude: number }} home
 * @param {{ latitude: number, longitude: number }} dest
 */
export function roundTripKmFromZoneCoords(home, dest) {
  return roundKm(2 * haversineKm(home, dest))
}

/**
 * @param {{ latitude: number, longitude: number }} from
 * @param {{ latitude: number, longitude: number }} to
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<number|null>} one-way distance in km
 */
export async function drivingDistanceKm(from, to, fetchFn = fetch) {
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=false`
  try {
    const res = await fetchFn(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    const metres = data?.routes?.[0]?.distance
    if (!Number.isFinite(metres) || metres <= 0) return null
    return Math.round((metres / 1000) * 10) / 10
  } catch {
    return null
  }
}

/**
 * @param {string} homeZoneId
 * @param {string} destZoneId
 * @param {import('./zone-coords.mjs').ZoneCoordsConfig} [config]
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<{ km: number, source: 'osrm' | 'zones' } | null>}
 */
export async function roundTripKm(homeZoneId, destZoneId, config = loadZoneCoords(), fetchFn = fetch) {
  const key = cacheKey(homeZoneId, destZoneId)
  const cached = memoryCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_MAX_AGE_MS) {
    return { km: cached.km, source: cached.source }
  }

  const home = getZoneCoord(config, homeZoneId)
  const dest = getZoneCoord(config, destZoneId)
  if (!home || !dest) return null

  const out = await drivingDistanceKm(home, dest, fetchFn)
  const back = await drivingDistanceKm(dest, home, fetchFn)

  let km
  let source
  if (out != null && back != null) {
    km = roundKm(out + back)
    source = 'osrm'
  } else {
    km = roundTripKmFromZoneCoords(home, dest)
    source = 'zones'
  }

  memoryCache.set(key, { km, source, at: Date.now() })
  return { km, source }
}

/**
 * @param {string} [destZoneId]
 * @param {import('./zone-coords.mjs').ZoneCoordsConfig} [config]
 * @param {typeof fetch} [fetchFn]
 */
export async function roundTripToSupermarket(destZoneId, config = loadZoneCoords(), fetchFn = fetch) {
  const dest = destZoneId || config.default_supermarket_zone
  if (!dest) return null
  return roundTripKm(config.home_zone, dest, config, fetchFn)
}

/**
 * @param {{ zone?: string }[]} visits
 * @param {import('./zone-coords.mjs').ZoneCoordsConfig} [config]
 * @param {typeof fetch} [fetchFn]
 */
export async function enrichVisitsWithTripDistance(visits, config = loadZoneCoords(), fetchFn = fetch) {
  /** @type {Record<string, { km: number, source: 'osrm' | 'zones' } | null>} */
  const byZone = {}

  const resolve = async (zone) => {
    const key = zone || config.default_supermarket_zone || ''
    if (!key) return null
    if (!(key in byZone)) {
      byZone[key] = await roundTripKm(config.home_zone, key, config, fetchFn)
    }
    return byZone[key]
  }

  const out = []
  for (const visit of visits) {
    const trip = await resolve(visit.zone)
    out.push(
      trip != null
        ? { ...visit, trip_distance_km: trip.km, trip_distance_source: trip.source }
        : visit
    )
  }
  return out
}
