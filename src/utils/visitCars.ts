import type { FuelType } from './fuelPrices'

export interface VisitCarLink {
  visit_entered_at: string
  car_id: string
  /** Round-trip km; frozen when the car is linked */
  distance_km?: number
  /** €/L at link time (DGEG); past visits keep this price */
  fuel_price_per_l?: number
  /** Fuel type at link time — keeps history accurate if the car profile changes */
  fuel_type?: FuelType
  linked_at: string
}

const LOCAL_KEY = 'nourish-visit-cars'

function loadLocalVisitCars(): VisitCarLink[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalVisitCars(list: VisitCarLink[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
}

export async function fetchVisitCars(): Promise<VisitCarLink[]> {
  try {
    const res = await fetch('/nourish/visit-cars', { cache: 'no-store' })
    if (!res.ok) return loadLocalVisitCars()
    const data = (await res.json()) as { links?: VisitCarLink[] }
    const list = Array.isArray(data.links) ? data.links : []
    saveLocalVisitCars(list)
    return list
  } catch {
    return loadLocalVisitCars()
  }
}

export async function linkCarToVisit(link: VisitCarLink): Promise<void> {
  saveLocalVisitCar(link)
  try {
    await fetch('/nourish/visit-cars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(link),
    })
  } catch {
    /* local fallback already saved */
  }
}

export async function unlinkCarFromVisit(visitEnteredAt: string): Promise<void> {
  const list = loadLocalVisitCars().filter((l) => l.visit_entered_at !== visitEnteredAt)
  saveLocalVisitCars(list)
  try {
    await fetch('/nourish/visit-cars', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visit_entered_at: visitEnteredAt }),
    })
  } catch {
    /* local fallback already saved */
  }
}

function saveLocalVisitCar(link: VisitCarLink) {
  const list = loadLocalVisitCars().filter((l) => l.visit_entered_at !== link.visit_entered_at)
  list.push(link)
  saveLocalVisitCars(list)
}

export function visitCarMap(links: VisitCarLink[]): Map<string, VisitCarLink> {
  return new Map(links.map((l) => [l.visit_entered_at, l]))
}
