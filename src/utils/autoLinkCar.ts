import { fetchCars, type Car } from '../hooks/useCars'
import { inferDefaultCarId } from './defaultCar'
import { fetchTripDistance } from './tripDistance'
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
  }
  await linkCarToVisit(link)
  return link
}
