import type { Car } from '../hooks/useCars'
import type { VisitCarLink } from './visitCars'

export interface TripDistanceSource {
  trip_distance_km?: number
}

export function tripKm(
  link: VisitCarLink | undefined,
  visit?: TripDistanceSource
): number | null {
  const km = link?.distance_km ?? visit?.trip_distance_km
  return Number.isFinite(km) && km! > 0 ? km! : null
}

/** Fuel €/L frozen on the visit link when the car was assigned. */
export function tripFuelPrice(link: VisitCarLink | undefined): number | null {
  const price = link?.fuel_price_per_l
  return Number.isFinite(price) && price! > 0 ? price! : null
}

export function visitTripCostEur(
  link: VisitCarLink | undefined,
  visit: TripDistanceSource | undefined,
  car: Car | undefined
): number | null {
  const km = tripKm(link, visit)
  const price = tripFuelPrice(link)
  if (km == null || !car || price == null) return null
  return tripCostEur(km, car, price)
}

export function tripFuelLitres(km: number, car: Car): number {
  return (km * car.consumption_l100km) / 100
}

export function tripCostEur(km: number, car: Car, fuelPricePerL: number): number {
  return tripFuelLitres(km, car) * fuelPricePerL
}

export function formatTripCost(eur: number): string {
  return `€${eur.toFixed(2)}`
}
