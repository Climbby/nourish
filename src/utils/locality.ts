import { getCurrentPosition, haversineM } from './supermarketSearch'

export interface Coords {
  latitude: number
  longitude: number
}

export interface LocalityResult {
  /** e.g. "Condeixa, Coimbra" */
  label: string
  coords: Coords
}

interface PhotonReverseFeature {
  properties?: {
    name?: string
    osm_key?: string
    osm_value?: string
    type?: string
    city?: string
    town?: string
    village?: string
    locality?: string
    municipality?: string
    county?: string
    state?: string
    district?: string
  }
}

const FOOD_PLACE_VALUES = new Set([
  'restaurant',
  'cafe',
  'fast_food',
  'bar',
  'pub',
  'food_court',
  'biergarten',
  'ice_cream',
  'canteen',
])

interface PhotonReverseResponse {
  features?: PhotonReverseFeature[]
}

/** Build "Condeixa, Coimbra" from Photon reverse properties. */
export function localityLabelFromPhotonProps(
  p: NonNullable<PhotonReverseFeature['properties']>
): string | null {
  const place = (
    p.locality ||
    p.village ||
    p.town ||
    p.city ||
    p.municipality ||
    p.district ||
    ''
  ).trim()
  const region = (p.county || p.state || '').trim()
  if (place && region && !place.toLowerCase().includes(region.toLowerCase())) {
    return `${place}, ${region}`
  }
  if (place) return place
  if (region) return region
  return null
}

/** POI name when Photon reverse landed on a restaurant / cafe / similar. */
export function restaurantNameFromPhotonProps(
  p: NonNullable<PhotonReverseFeature['properties']>
): string | null {
  const name = (p.name ?? '').trim()
  if (!name) return null
  const value = (p.osm_value || p.type || '').toLowerCase()
  if (FOOD_PLACE_VALUES.has(value)) return name
  return null
}

async function photonReverseProps(
  coords: Coords
): Promise<NonNullable<PhotonReverseFeature['properties']> | null> {
  const url = new URL('https://photon.komoot.io/reverse')
  url.searchParams.set('lon', String(coords.longitude))
  url.searchParams.set('lat', String(coords.latitude))
  url.searchParams.set('lang', 'pt')
  try {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as PhotonReverseResponse
    return data.features?.[0]?.properties ?? null
  } catch {
    return null
  }
}

/** Reverse-geocode coords → locality label via Photon. */
export async function reverseGeocodeLocality(coords: Coords): Promise<LocalityResult | null> {
  const props = await photonReverseProps(coords)
  if (!props) return null
  const label = localityLabelFromPhotonProps(props)
  if (!label) return null
  return { label, coords }
}

const NEAR_RESTAURANT_M = 150

/** Nearby restaurant/cafe name for Estou aqui — never a city/locality label. */
export async function suggestRestaurantAt(coords: Coords): Promise<string | null> {
  const props = await photonReverseProps(coords)
  if (props) {
    const fromReverse = restaurantNameFromPhotonProps(props)
    if (fromReverse) return fromReverse
  }

  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', 'restaurante')
  url.searchParams.set('lat', String(coords.latitude))
  url.searchParams.set('lon', String(coords.longitude))
  url.searchParams.set('limit', '5')
  url.searchParams.set('lang', 'pt')
  url.searchParams.append('osm_tag', 'amenity:restaurant')
  url.searchParams.append('osm_tag', 'amenity:cafe')
  url.searchParams.append('osm_tag', 'amenity:fast_food')

  try {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as PhotonReverseResponse & {
      features?: Array<{
        geometry?: { coordinates?: [number, number] }
        properties?: PhotonReverseFeature['properties']
      }>
    }
    let best: { name: string; metres: number } | null = null
    for (const feature of data.features ?? []) {
      const name = restaurantNameFromPhotonProps(feature.properties ?? {})
      const pair = feature.geometry?.coordinates
      if (!name || !pair) continue
      const metres = haversineM(coords, { latitude: pair[1], longitude: pair[0] })
      if (metres > NEAR_RESTAURANT_M) continue
      if (!best || metres < best.metres) best = { name, metres }
    }
    return best?.name ?? null
  } catch {
    return null
  }
}

/** GPS + reverse geocode → locality for a Fora meal. */
export async function captureLocalityHere(): Promise<LocalityResult> {
  const coords = await getCurrentPosition()
  const result = await reverseGeocodeLocality(coords)
  if (result) return result
  return {
    label: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
    coords,
  }
}

export function formatDistanceKm(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`
  const km = metres / 1000
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`
}

/** Rough driving ETA from straight-line distance (~40 km/h average). */
export function estimateDriveMinutes(metres: number): number {
  const hours = metres / 1000 / 40
  return Math.max(1, Math.round(hours * 60))
}

export function distanceFromHome(
  home: Coords | null | undefined,
  meal: Coords | null | undefined
): number | null {
  if (!home || !meal) return null
  if (!Number.isFinite(home.latitude) || !Number.isFinite(home.longitude)) return null
  if (!Number.isFinite(meal.latitude) || !Number.isFinite(meal.longitude)) return null
  return haversineM(home, meal)
}

export function formatLocalityMeta(
  metres: number | null
): string | null {
  if (metres == null) return null
  return `${formatDistanceKm(metres)} · ~${estimateDriveMinutes(metres)} min`
}
