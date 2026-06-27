import type { Car } from '../hooks/useCars'
import { carDisplayName } from './carDisplayName'
import type { FuelType } from './fuelPrices'
import { fuelTypeLabel } from './fuelPrices'
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

export function formatFuelPricePerL(eurPerL: number): string {
  return `€${eurPerL.toFixed(3)}/L`
}

export function visitFuelType(
  link: VisitCarLink | undefined,
  car: Car | undefined
): FuelType {
  return link?.fuel_type ?? car?.fuel_type ?? 'diesel'
}

/** Fuel type + price frozen when the car was linked to this visit. */
export function formatVisitFuelDetail(
  link: VisitCarLink | undefined,
  car: Car | undefined
): string | null {
  if (!car) return null
  const fuelType = visitFuelType(link, car)
  const price = tripFuelPrice(link)
  const label = fuelTypeLabel(fuelType)
  if (price != null) return `${label} · ${formatFuelPricePerL(price)} na visita`
  return label
}

export function formatVisitCarSummary(
  link: VisitCarLink | undefined,
  car: Car | undefined,
  visit?: TripDistanceSource,
  allCars: Car[] = []
): string | null {
  if (!car) return null
  const km = tripKm(link, visit)
  const fuel = formatVisitFuelDetail(link, car)
  const cost = visitTripCostEur(link, visit, car)
  const parts = [carDisplayName(car, allCars)]
  if (km != null) parts.push(`${km} km ida/volta`)
  if (fuel) parts.push(fuel)
  if (cost != null) parts.push(formatTripCost(cost))
  return parts.length > 1 ? parts.join(' · ') : null
}
