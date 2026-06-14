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
