import { fetchCars, type Car } from '../hooks/useCars'
import { inferDefaultCarId } from './defaultCar'
import { fetchTripDistance } from './tripDistance'
import type { SupermarketVisit } from './supermarketVisits'
import { fetchVisitCars, linkCarToVisit, type VisitCarLink } from './visitCars'

export async function autoLinkCarToVisit(
  visitEnteredAt: string,
  options: {
    zone?: string
    cars?: Car[]
    visitCars?: VisitCarLink[]
    fuelPricePerL?: number | null
  } = {}
): Promise<VisitCarLink | null> {
  const visitCars = options.visitCars ?? (await fetchVisitCars())
  if (visitCars.some((l) => l.visit_entered_at === visitEnteredAt)) return null

  const cars = options.cars ?? (await fetchCars())
  const carId = inferDefaultCarId(cars, visitCars)
  if (!carId) return null

  const car = cars.find((c) => c.id === carId)
  if (!car) return null

  let distanceKm: number | undefined
  if (options.zone) {
    const routed = await fetchTripDistance(options.zone)
    distanceKm = routed?.round_trip_km
  }

  const link: VisitCarLink = {
    visit_entered_at: visitEnteredAt,
    car_id: carId,
    linked_at: new Date().toISOString(),
    ...(distanceKm != null ? { distance_km: distanceKm } : {}),
    ...(options.fuelPricePerL != null ? { fuel_price_per_l: options.fuelPricePerL } : {}),
    ...(car.fuel_type ? { fuel_type: car.fuel_type } : {}),
  }
  await linkCarToVisit(link)
  return link
}

/** Link every unlinked completed visit when a default car is known (sole car or last used). */
export async function autoLinkUnlinkedVisitCars(
  visits: SupermarketVisit[],
  cars: Car[],
  existingLinks: VisitCarLink[],
  fuelPriceForCar?: (car: Car) => number | null
): Promise<VisitCarLink[]> {
  const carId = inferDefaultCarId(cars, existingLinks)
  if (!carId) return []

  const car = cars.find((c) => c.id === carId)
  if (!car) return []

  const linked = new Set(existingLinks.map((l) => l.visit_entered_at))
  const fuelPrice = fuelPriceForCar?.(car) ?? null
  const created: VisitCarLink[] = []
  let links = existingLinks

  for (const visit of visits) {
    if (linked.has(visit.entered_at) || visit.ongoing) continue
    const link = await autoLinkCarToVisit(visit.entered_at, {
      zone: visit.zone,
      cars,
      visitCars: links,
      fuelPricePerL: fuelPrice ?? undefined,
    })
    if (link) {
      created.push(link)
      links = [...links, link]
    }
  }

  return created
}
