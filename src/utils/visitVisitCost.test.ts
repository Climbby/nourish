import { describe, expect, it } from 'vitest'
import { formatVisitTotalCost, visitTotalCostEur } from './visitVisitCost'
import type { VisitReceiptLink } from './visitReceipts'

const receipt: VisitReceiptLink = {
  visit_entered_at: '2026-06-01T10:00:00.000Z',
  purchased_date: '2026-06-01',
  item_count: 12,
  total_eur: 45.67,
  linked_at: '2026-06-01T12:00:00.000Z',
}

describe('visitVisitCost', () => {
  it('combines receipt and fuel when both exist', () => {
    expect(visitTotalCostEur(receipt, 2.45)).toEqual({ total: 48.12, kind: 'combined' })
    expect(formatVisitTotalCost(receipt, 2.45)).toEqual({
      main: '€48.12',
      detail: '€45.67 talão + €2.45 combustível',
    })
  })

  it('shows receipt only when fuel is missing', () => {
    expect(visitTotalCostEur(receipt, null)).toEqual({ total: 45.67, kind: 'receipt' })
    expect(formatVisitTotalCost(receipt, null)).toEqual({ main: '€45.67' })
  })

  it('shows nothing when only fuel is available', () => {
    expect(visitTotalCostEur(undefined, 2.45)).toBeNull()
    expect(formatVisitTotalCost(undefined, 2.45)).toBeNull()
  })

  it('shows nothing without receipt total', () => {
    expect(visitTotalCostEur({ ...receipt, total_eur: 0 }, 2.45)).toBeNull()
  })
})
