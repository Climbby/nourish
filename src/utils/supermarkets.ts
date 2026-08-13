export interface TrackedSupermarket {
  id: string
  name: string
  place_key: string
  zone_id?: string
  latitude?: number
  longitude?: number
  added_at: string
}

export interface BlockedPlace {
  place_key: string
  name: string
  blocked_at: string
}

export interface SupermarketsData {
  tracked: TrackedSupermarket[]
  blocklist: BlockedPlace[]
}

export async function fetchSupermarkets(): Promise<SupermarketsData | null> {
  try {
    const res = await fetch('/nourish/supermarkets', { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as SupermarketsData
  } catch {
    return null
  }
}

export async function unblockPlace(placeKey: string): Promise<boolean> {
  try {
    const res = await fetch('/nourish/supermarkets/blocklist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_key: placeKey }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function removeTracked(placeKey: string): Promise<boolean> {
  try {
    const res = await fetch('/nourish/supermarkets/tracked', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_key: placeKey }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function trackSupermarket(input: {
  place: string
  latitude?: number
  longitude?: number
  /** True only when GPS shows the user is at this store right now. */
  registerVisit?: boolean
}): Promise<boolean> {
  try {
    const res = await fetch('/nourish/supermarkets/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'track',
        place: input.place,
        latitude: input.latitude,
        longitude: input.longitude,
        create_ha_zone: true,
        register_visit: input.registerVisit === true,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Record supermarket_enter for an already-tracked zone (user is there now). */
export async function registerSupermarketVisit(zoneId: string): Promise<boolean> {
  try {
    const res = await fetch('/nourish/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'supermarket_enter', zone: zoneId }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function blockSupermarket(place: string): Promise<boolean> {
  try {
    const res = await fetch('/nourish/supermarkets/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'block', place }),
    })
    return res.ok
  } catch {
    return false
  }
}
