import { describe, expect, it } from 'vitest'
import type { SupermarketVisit } from '../../api/homelabMetrics'
import { localReceiptToUtcMs, matchVisitForReceipt, storeToZone } from './matchVisit'

const visit = (over: Partial<SupermarketVisit> = {}): SupermarketVisit => ({
  entered_at: '2026-06-23T09:31:05.000Z',
  left_at: '2026-06-23T09:46:17.000Z',
  duration_minutes: 15,
  ongoing: false,
  zone: 'zone.auchan',
  ...over,
})

describe('localReceiptToUtcMs', () => {
  it('treats receipt wall time as Lisbon (UTC+1 in June)', () => {
    // 10:39 local in summer (WEST) → 09:39 UTC
    expect(localReceiptToUtcMs('2026-06-23T10:39')).toBe(Date.UTC(2026, 5, 23, 9, 39, 0))
  })

  it('returns null for junk or missing time', () => {
    expect(localReceiptToUtcMs(null)).toBeNull()
    expect(localReceiptToUtcMs('2026-06-23')).toBeNull()
  })
})

describe('storeToZone', () => {
  it('maps known stores', () => {
    expect(storeToZone('auchan')).toBe('zone.auchan')
    expect(storeToZone('continente')).toBe('zone.continente')
    expect(storeToZone('other')).toBeNull()
  })
})

describe('matchVisitForReceipt', () => {
  it('matches the visit whose window contains the receipt time', () => {
    // receipt 10:39 local = 09:39 UTC, inside 09:31–09:46
    expect(matchVisitForReceipt('2026-06-23T10:39', 'auchan', [visit()])).toMatchObject({
      entered_at: '2026-06-23T09:31:05.000Z',
    })
  })

  it('excludes a visit in a different zone than the store', () => {
    expect(matchVisitForReceipt('2026-06-23T10:39', 'auchan', [visit({ zone: 'zone.continente' })])).toBeNull()
  })

  it('still matches by time when the store is unknown', () => {
    expect(matchVisitForReceipt('2026-06-23T10:39', 'other', [visit({ zone: undefined })])).not.toBeNull()
  })

  it('returns null when no visit is near the receipt time', () => {
    expect(matchVisitForReceipt('2026-06-23T18:00', 'auchan', [visit()])).toBeNull()
  })

  it('picks the closest visit when several overlap the tolerance', () => {
    const morning = visit()
    const evening = visit({
      entered_at: '2026-06-23T17:00:00.000Z',
      left_at: '2026-06-23T17:20:00.000Z',
    })
    const m = matchVisitForReceipt('2026-06-23T10:39', 'auchan', [evening, morning])
    expect(m?.entered_at).toBe(morning.entered_at)
  })
})
