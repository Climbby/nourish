export interface SupermarketSearchHit {
  id: string
  /** Name sent to the track/block API (includes city when useful). */
  name: string
  /** Primary line in the UI. */
  title: string
  /** Address / place detail line. */
  subtitle: string
  latitude: number
  longitude: number
  /** Metres from search origin when known. */
  distanceM?: number
}

/** Already tracked or ignored — used to hide duplicates in search. */
export interface KnownSupermarketRef {
  place_key: string
  name: string
  latitude?: number
  longitude?: number
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    osm_id?: number | string
    osm_type?: string
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    town?: string
    village?: string
    locality?: string
    district?: string
    county?: string
    state?: string
    country?: string
    type?: string
    osm_value?: string
    osm_key?: string
  }
}

interface PhotonResponse {
  features?: PhotonFeature[]
}

const PT_BRANDS = [
  'Continente',
  'Auchan',
  'Pingo Doce',
  'Lidl',
  'Aldi',
  'Intermarché',
  'Minipreço',
  'Mercadona',
]

export const SUPERMARKET_BRAND_CHIPS = PT_BRANDS

/** Same normalisation as homelab/supermarkets.mjs */
export function normalizePlaceKey(place: string): string {
  return String(place || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Only real shop POIs — skip recycling points, brand parking, etc. */
function isSupermarketPoi(f: PhotonFeature): boolean {
  const p = f.properties
  if (!p) return false
  return (
    p.osm_key === 'shop' &&
    (p.osm_value === 'supermarket' || p.osm_value === 'convenience' || p.osm_value === 'mall')
  )
}

function placeCity(p: NonNullable<PhotonFeature['properties']>): string {
  return (p.locality || p.city || p.town || p.village || p.district || '').trim()
}

function formatHit(f: PhotonFeature): SupermarketSearchHit | null {
  if (!isSupermarketPoi(f)) return null
  const coords = f.geometry?.coordinates
  const p = f.properties
  if (!coords || !p) return null
  const [lon, lat] = coords
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const title = (p.name || '').trim()
  if (!title) return null

  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const city = placeCity(p)
  const detailParts = [street, city, p.postcode].filter(Boolean)
  const subtitle = detailParts.join(' · ') || 'Supermercado'

  // Prefer "Auchan Condeixa-a-Nova" over bare "Auchan" when saving
  const name =
    city && !title.toLowerCase().includes(city.toLowerCase())
      ? `${title.replace(/\s+Supermercado$/i, '').trim()} ${city}`
      : title

  return {
    id: `${p.osm_type ?? 'n'}-${p.osm_id ?? `${lat},${lon}`}`,
    name,
    title,
    subtitle,
    latitude: lat,
    longitude: lon,
  }
}

export function haversineM(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Drop near-duplicate POIs (same store mapped twice within ~80 m). */
function dedupeNearby(hits: SupermarketSearchHit[], radiusM = 80): SupermarketSearchHit[] {
  const out: SupermarketSearchHit[] = []
  for (const hit of hits) {
    if (out.some((kept) => haversineM(kept, hit) < radiusM)) continue
    out.push(hit)
  }
  return out
}

function keysMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

/** True if this search hit is already tracked or ignored. */
export function isKnownSupermarket(
  hit: Pick<SupermarketSearchHit, 'name' | 'title' | 'latitude' | 'longitude'>,
  known: KnownSupermarketRef[],
  nearRadiusM = 100
): boolean {
  const nameKey = normalizePlaceKey(hit.name)
  const titleKey = normalizePlaceKey(hit.title)
  for (const k of known) {
    if (keysMatch(nameKey, k.place_key) || keysMatch(titleKey, k.place_key)) return true
    const knownNameKey = normalizePlaceKey(k.name)
    if (keysMatch(nameKey, knownNameKey) || keysMatch(titleKey, knownNameKey)) return true
    if (
      typeof k.latitude === 'number' &&
      typeof k.longitude === 'number' &&
      Number.isFinite(k.latitude) &&
      Number.isFinite(k.longitude) &&
      haversineM(hit, { latitude: k.latitude, longitude: k.longitude }) < nearRadiusM
    ) {
      return true
    }
  }
  return false
}

export function filterKnownSupermarkets(
  hits: SupermarketSearchHit[],
  known: KnownSupermarketRef[]
): SupermarketSearchHit[] {
  if (known.length === 0) return hits
  return hits.filter((h) => !isKnownSupermarket(h, known))
}

/**
 * When the user is at the store, prefer phone GPS for the HA zone —
 * OSM centroids often sit a few dozen metres off the Google Maps pin.
 */
export function coordsForTracking(
  hit: SupermarketSearchHit,
  userGps: { latitude: number; longitude: number } | null | undefined,
  preferGpsWithinM = 250
): { latitude: number; longitude: number } {
  if (
    userGps &&
    Number.isFinite(userGps.latitude) &&
    Number.isFinite(userGps.longitude) &&
    haversineM(hit, userGps) <= preferGpsWithinM
  ) {
    return { latitude: userGps.latitude, longitude: userGps.longitude }
  }
  return { latitude: hit.latitude, longitude: hit.longitude }
}

async function photonSearch(
  query: string,
  near?: { latitude: number; longitude: number } | null
): Promise<SupermarketSearchHit[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '12')
  url.searchParams.set('lang', 'en')
  url.searchParams.set('osm_tag', 'shop:supermarket')
  if (near) {
    url.searchParams.set('lat', String(near.latitude))
    url.searchParams.set('lon', String(near.longitude))
  }

  const res = await fetch(url.toString())
  if (!res.ok) return []
  const data = (await res.json()) as PhotonResponse
  let hits = (data.features ?? [])
    .map(formatHit)
    .filter((h): h is SupermarketSearchHit => h != null)

  if (near) {
    hits = hits
      .map((h) => ({ ...h, distanceM: Math.round(haversineM(h, near)) }))
      .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0))
  }

  return dedupeNearby(hits).slice(0, 8)
}

async function photonReverse(
  latitude: number,
  longitude: number
): Promise<SupermarketSearchHit[]> {
  const url = new URL('https://photon.komoot.io/reverse')
  url.searchParams.set('lat', String(latitude))
  url.searchParams.set('lon', String(longitude))
  url.searchParams.set('limit', '8')
  url.searchParams.set('lang', 'en')
  // Prefer shops around the point
  url.searchParams.set('osm_tag', 'shop:supermarket')

  try {
    const res = await fetch(url.toString())
    if (!res.ok) return []
    const data = (await res.json()) as PhotonResponse
    const origin = { latitude, longitude }
    return (data.features ?? [])
      .map(formatHit)
      .filter((h): h is SupermarketSearchHit => h != null)
      .map((h) => ({ ...h, distanceM: Math.round(haversineM(h, origin)) }))
  } catch {
    return []
  }
}

/** Smart name search, biased to the user's location when available. */
export async function searchSupermarkets(
  query: string,
  near?: { latitude: number; longitude: number } | null
): Promise<SupermarketSearchHit[]> {
  return photonSearch(query, near)
}

/**
 * Find a supermarket near the given GPS point.
 * Reverse-geocode first, then brand search; results sorted by distance.
 */
export async function findSupermarketNear(
  latitude: number,
  longitude: number
): Promise<SupermarketSearchHit[]> {
  const origin = { latitude, longitude }
  const nearby: SupermarketSearchHit[] = []
  const seen = new Set<string>()

  const reverse = await photonReverse(latitude, longitude)
  for (const h of reverse) {
    if (seen.has(h.id)) continue
    if ((h.distanceM ?? haversineM(h, origin)) > 400) continue
    nearby.push(h)
    seen.add(h.id)
  }

  for (const brand of PT_BRANDS) {
    const found = await searchSupermarkets(brand, origin)
    for (const h of found) {
      if (seen.has(h.id)) continue
      const d = h.distanceM ?? haversineM(h, origin)
      if (d > 600) continue
      nearby.push({ ...h, distanceM: Math.round(d) })
      seen.add(h.id)
    }
  }

  return dedupeNearby(nearby)
    .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0))
    .slice(0, 6)
}

export function getCurrentPosition(
  options?: PositionOptions
): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização indisponível'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => reject(new Error('Não foi possível obter a localização')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30_000, ...options }
    )
  })
}
