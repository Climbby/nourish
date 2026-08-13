import type { Coords } from './locality'

export interface HomeCoords {
  latitude: number
  longitude: number
  zone?: string
}

/** Home zone lat/lon from homelab zone-coords (for Fora distance sort). */
export async function fetchHomeCoords(): Promise<HomeCoords | null> {
  try {
    const res = await fetch('/nourish/home-coords', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<HomeCoords>
    if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) return null
    return {
      latitude: data.latitude as number,
      longitude: data.longitude as number,
      zone: data.zone,
    }
  } catch {
    return null
  }
}

export function asCoords(home: HomeCoords | null): Coords | null {
  if (!home) return null
  return { latitude: home.latitude, longitude: home.longitude }
}
