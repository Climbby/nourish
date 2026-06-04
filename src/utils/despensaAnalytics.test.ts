import { describe, expect, it } from 'vitest'
import {
  buildDespensaDescription,
  getBuyAmountFromDesc,
  getDespensaUnitPrice,
  getPriceFromDesc,
  purchaseTotalPrice,
} from './despensaAnalytics'

describe('despensa description helpers', () => {
  it('parses buy amount and price', () => {
    const desc = buildDespensaDescription(6, 1.29)
    expect(getBuyAmountFromDesc(desc)).toBe(6)
    expect(getPriceFromDesc(desc)).toBe(1.29)
  })

  it('builds buy-only description', () => {
    expect(buildDespensaDescription(1)).toBe('[BuyAmount]\n1')
    expect(getPriceFromDesc('[BuyAmount]\n1')).toBeNull()
  })

  it('prefers stock value for unit price when in stock', () => {
    expect(getDespensaUnitPrice(2, 5, '[Preco]\n1.00')).toBe(2.5)
  })

  it('falls back to description price when stock is empty', () => {
    expect(getDespensaUnitPrice(0, 0, '[Preco]\n1.29')).toBe(1.29)
  })

  it('computes purchase total from unit price', () => {
    expect(purchaseTotalPrice(1.29, 6)).toBe(7.74)
    expect(purchaseTotalPrice(null, 6)).toBeUndefined()
  })
})
