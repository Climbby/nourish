export interface TripDistance {
  zone: string
  round_trip_km: number
  /** osrm = road routing; zones = straight-line between HA zone centres */
  source?: 'osrm' | 'zones'
}

export async function fetchTripDistance(zone?: string): Promise<TripDistance | null> {
  try {
    const q = zone ? `?zone=${encodeURIComponent(zone)}` : ''
    const res = await fetch(`/nourish/trip-distance${q}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as TripDistance
    if (!Number.isFinite(data.round_trip_km) || data.round_trip_km <= 0) return null
    return data
  } catch {
    return null
  }
}

export function visitTripKm(
  visit: { trip_distance_km?: number } | undefined,
  link: { distance_km?: number } | undefined
): number | null {
  const km = link?.distance_km ?? visit?.trip_distance_km
  return Number.isFinite(km) && km! > 0 ? km! : null
}
