import { describe, expect, it } from 'vitest'
import type { Car } from '../hooks/useCars'
import type { VisitCarLink } from './visitCars'
import { inferDefaultCarId } from './defaultCar'

const cars: Car[] = [
  { id: 'a', name: 'Golf', consumption_l100km: 5 },
  { id: 'b', name: 'Civic', consumption_l100km: 6 },
]

describe('inferDefaultCarId', () => {
  it('returns null when no cars', () => {
    expect(inferDefaultCarId([], [])).toBeNull()
  })

  it('returns the only car', () => {
    expect(inferDefaultCarId([cars[0]], [])).toBe('a')
  })

  it('returns the most recently linked car', () => {
    const links: VisitCarLink[] = [
      { visit_entered_at: '1', car_id: 'a', linked_at: '2026-01-01T10:00:00Z' },
      { visit_entered_at: '2', car_id: 'b', linked_at: '2026-06-01T10:00:00Z' },
    ]
    expect(inferDefaultCarId(cars, links)).toBe('b')
  })

  it('skips links to removed cars', () => {
    const links: VisitCarLink[] = [
      { visit_entered_at: '1', car_id: 'gone', linked_at: '2026-06-01T10:00:00Z' },
      { visit_entered_at: '2', car_id: 'a', linked_at: '2026-01-01T10:00:00Z' },
    ]
    expect(inferDefaultCarId(cars, links)).toBe('a')
  })

  it('returns null with multiple cars and no history', () => {
    expect(inferDefaultCarId(cars, [])).toBeNull()
  })
})
