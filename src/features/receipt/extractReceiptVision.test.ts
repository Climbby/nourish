import { describe, expect, it } from 'vitest'
import { normalizeVisionReceipt, parseNum } from './extractReceiptVision'

describe('parseNum', () => {
  it('parses comma and dot decimals and strips currency', () => {
    expect(parseNum('1,09')).toBe(1.09)
    expect(parseNum('1.09')).toBe(1.09)
    expect(parseNum('2,94 EUR')).toBe(2.94)
    expect(parseNum(3.5)).toBe(3.5)
  })

  it('returns null for junk', () => {
    expect(parseNum('abc')).toBeNull()
    expect(parseNum(null)).toBeNull()
    expect(parseNum(undefined)).toBeNull()
  })
})

describe('normalizeVisionReceipt', () => {
  it('keeps valid product lines and derives unit price when missing', () => {
    const r = normalizeVisionReceipt({
      store: 'My Auchan',
      purchasedDate: '2026-06-23',
      total: '4.03',
      lines: [
        { name: 'LEITE MEIO GORDO', qty: 1, unitPrice: '1,02', lineTotal: '1,02' },
        { name: 'BANANA', qty: '1,5', lineTotal: '2,94' }, // no unitPrice
      ],
    })
    expect(r.store).toBe('auchan')
    expect(r.purchasedDate).toBe('2026-06-23')
    expect(r.total).toBe(4.03)
    expect(r.lines).toHaveLength(2)
    expect(r.lines[1].unitPrice).toBeCloseTo(2.94 / 1.5)
  })

  it('drops empty names, zero/negative totals, and exact duplicates', () => {
    const r = normalizeVisionReceipt({
      lines: [
        { name: '', lineTotal: '1,00' },
        { name: 'TROCO', lineTotal: '0' },
        { name: 'ATUM', lineTotal: '-1,50' },
        { name: 'PAO', qty: 1, lineTotal: '0,60' },
        { name: 'PAO', qty: 1, lineTotal: '0,60' }, // duplicate
      ],
    })
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].name).toBe('PAO')
  })

  it('extracts purchasedAt date+time and derives purchasedDate', () => {
    const r = normalizeVisionReceipt({ store: 'auchan', purchasedAt: '2026-06-23 10:39', lines: [] })
    expect(r.purchasedAt).toBe('2026-06-23T10:39')
    expect(r.purchasedDate).toBe('2026-06-23')
  })

  it('keeps purchasedAt null when only a date is present', () => {
    const r = normalizeVisionReceipt({ purchasedAt: '2026-06-23', lines: [] })
    expect(r.purchasedAt).toBeNull()
    expect(r.purchasedDate).toBe('2026-06-23')
  })

  it('normalizes dd/mm/yyyy dates and unknown stores', () => {
    const r = normalizeVisionReceipt({ store: 'Pingo Doce', purchasedDate: '23/06/2026', lines: [] })
    expect(r.purchasedDate).toBe('2026-06-23')
    expect(r.store).toBeNull()
    expect(r.lines).toEqual([])
  })

  it('tolerates a missing/garbage payload', () => {
    expect(normalizeVisionReceipt(null).lines).toEqual([])
    expect(normalizeVisionReceipt({ lines: 'nope' }).lines).toEqual([])
  })
})
