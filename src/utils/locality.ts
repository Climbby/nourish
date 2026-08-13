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

/** Reverse-geocode coords → locality label via Photon. */
export async function reverseGeocodeLocality(coords: Coords): Promise<LocalityResult | null> {
  const url = new URL('https://photon.komoot.io/reverse')
  url.searchParams.set('lon', String(coords.longitude))
  url.searchParams.set('lat', String(coords.latitude))
  url.searchParams.set('lang', 'en')
  try {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as PhotonReverseResponse
    const props = data.features?.[0]?.properties
    if (!props) return null
    const label = localityLabelFromPhotonProps(props)
    if (!label) return null
    return { label, coords }
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
