import type { Car } from '../hooks/useCars'

/** First word of the car name — treated as make/brand (e.g. "Audi" from "Audi A3"). */
export function carMake(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

/** Short label when the fleet has only one car for that make; otherwise full name. */
export function carDisplayName(car: Car, allCars: Car[]): string {
  const make = carMake(car.name)
  const sameMake = allCars.filter((c) => carMake(c.name).toLowerCase() === make.toLowerCase())
  return sameMake.length === 1 ? make : car.name
}
