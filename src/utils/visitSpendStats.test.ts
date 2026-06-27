import { describe, expect, it } from 'vitest'
import type { SupermarketVisit } from '../api/homelabMetrics'
import type { Car } from '../hooks/useCars'
import { aggregateVisitSpend, buildVisitFuelTrips, buildVisitShoppingTrips, filterVisitsByPeriod } from './visitSpendStats'
import type { VisitCarLink } from './visitCars'
import type { VisitReceiptLink } from './visitReceipts'

const car: Car = { id: 'c1', name: 'Audi A3', consumption_l100km: 7.2, fuel_type: 'gpl_gasoline' }

const visit: SupermarketVisit = {
  entered_at: '2026-06-26T19:15:06.469Z',
  left_at: '2026-06-26T19:34:05.216Z',
  duration_minutes: 19,
  ongoing: false,
  trip_distance_km: 6.6,
}

describe('visitSpendStats', () => {
  it('filters visits by period', () => {
    const visits: SupermarketVisit[] = [
      visit,
      { ...visit, entered_at: '2026-05-01T10:00:00.000Z', duration_minutes: 20 },
      { ...visit, entered_at: '2026-06-26T19:20:00.000Z', duration_minutes: 1, ongoing: false },
    ]
    const now = new Date('2026-06-27T12:00:00.000Z')
    const in7d = filterVisitsByPeriod(visits, '7d', now)
    expect(in7d).toHaveLength(1)
    expect(in7d[0].entered_at).toBe(visit.entered_at)
  })

  it('aggregates shopping and fuel spend', () => {
    const link: VisitCarLink = {
      visit_entered_at: visit.entered_at,
      car_id: 'c1',
      distance_km: 6.6,
      fuel_price_per_l: 0.921,
      linked_at: '2026-06-26T20:00:00.000Z',
    }
    const receipt: VisitReceiptLink = {
      visit_entered_at: visit.entered_at,
      purchased_date: '2026-06-26',
      item_count: 12,
      total_eur: 45.67,
      linked_at: '2026-06-26T20:00:00.000Z',
    }
    const totals = aggregateVisitSpend([visit], [link], [receipt], new Map([['c1', car]]))
    expect(totals.shoppingEur).toBe(45.67)
    expect(totals.visitsWithReceipt).toBe(1)
    expect(totals.visitsWithFuelCost).toBe(1)
    expect(totals.fuelEur).toBeGreaterThan(0)
  })

  it('builds fuel trip rows for the period', () => {
    const link: VisitCarLink = {
      visit_entered_at: visit.entered_at,
      car_id: 'c1',
      distance_km: 6.6,
      fuel_price_per_l: 0.921,
      linked_at: '2026-06-26T20:00:00.000Z',
    }
    const trips = buildVisitFuelTrips(
      [visit],
      [link],
      new Map([['c1', car]]),
      () => 'Auchan'
    )
    expect(trips).toHaveLength(1)
    expect(trips[0].destination).toBe('Auchan')
    expect(trips[0].km).toBe(6.6)
    expect(trips[0].fuelEur).toBeGreaterThan(0)
  })

  it('builds shopping trip rows for the period', () => {
    const receipt: VisitReceiptLink = {
      visit_entered_at: visit.entered_at,
      purchased_date: '2026-06-26',
      item_count: 12,
      total_eur: 45.67,
      linked_at: '2026-06-26T20:00:00.000Z',
    }
    const trips = buildVisitShoppingTrips([visit], [receipt], () => 'Auchan')
    expect(trips).toHaveLength(1)
    expect(trips[0].totalEur).toBe(45.67)
    expect(trips[0].itemCount).toBe(12)
  })
})
