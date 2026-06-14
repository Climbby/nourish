import { describe, expect, it } from 'vitest'
import { tripCostEur, tripKm, visitTripCostEur } from './visitTripCost'
import type { Car } from '../hooks/useCars'
import type { VisitCarLink } from './visitCars'

const car: Car = {
  id: 'c1',
  name: 'Golf',
  consumption_l100km: 6,
  fuel_type: 'diesel',
}

describe('visitTripCost', () => {
  it('uses routed visit km when no link override', () => {
    expect(tripKm(undefined, { trip_distance_km: 9.4 })).toBe(9.4)
    expect(tripCostEur(9.4, car, 1.5)).toBeCloseTo(0.846)
    expect(visitTripCostEur(undefined, { trip_distance_km: 9.4 }, car)).toBeNull()
  })

  it('uses distance stored on link', () => {
    const link: VisitCarLink = {
      visit_entered_at: '2026-06-01T10:00:00.000Z',
      car_id: 'c1',
      distance_km: 8,
      fuel_price_per_l: 1.5,
      linked_at: '2026-06-01T12:00:00.000Z',
    }
    expect(tripKm(link, undefined)).toBe(8)
    expect(visitTripCostEur(link, undefined, car)).toBeCloseTo(0.72)
  })

  it('returns null cost without snapshotted fuel price', () => {
    const link: VisitCarLink = {
      visit_entered_at: '2026-06-01T10:00:00.000Z',
      car_id: 'c1',
      distance_km: 8,
      linked_at: '2026-06-01T12:00:00.000Z',
    }
    expect(visitTripCostEur(link, undefined, car)).toBeNull()
  })

  it('returns null when no routed distance', () => {
    expect(tripKm(undefined, undefined)).toBeNull()
  })
})
