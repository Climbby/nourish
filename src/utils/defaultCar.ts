import type { Car } from '../hooks/useCars'
import type { VisitCarLink } from './visitCars'

/** Pick a car to auto-assign: sole car, or most recently linked on a past visit. */
export function inferDefaultCarId(cars: Car[], visitCarLinks: VisitCarLink[]): string | null {
  if (cars.length === 0) return null
  if (cars.length === 1) return cars[0].id

  const recent = [...visitCarLinks].sort((a, b) => b.linked_at.localeCompare(a.linked_at))
  for (const link of recent) {
    if (cars.some((c) => c.id === link.car_id)) return link.car_id
  }
  return null
}
