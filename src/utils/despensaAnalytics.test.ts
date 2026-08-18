import { describe, expect, it } from 'vitest'
import type { StockLogEntry } from '../types/grocy'
import {
  buildDespensaDescription,
  consumptionScore,
  cookingName,
  formatDespensaPriceLabel,
  getBuyAmountFromDesc,
  getDespensaUnitPrice,
  getNomeCurtoFromDesc,
  getPriceFromDesc,
  getStoreFromDesc,
  getUnitGramsFromDesc,
  inferUnitGramsFromName,
  inferUnitGramsFromNames,
  ingredientDisplayName,
  purchaseTotalPrice,
  shortStoreBrand,
  sortByConsumption,
} from './despensaAnalytics'

function consume(productId: number, amount: number, ts: string): StockLogEntry {
  return {
    id: 1,
    product_id: productId,
    amount: -Math.abs(amount),
    transaction_type: 'consume',
    undone: 0,
    row_created_timestamp: ts,
  } as StockLogEntry
}

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

  it('stores and shortens purchase store', () => {
    const desc = buildDespensaDescription(1, 2.25, {
      storeLabel: 'Continente Bom Dia Condeixa-a-Nova',
      verified: new Set(['preco']),
      priceUnit: 'kg',
    })
    expect(getStoreFromDesc(desc)).toBe('Continente Bom Dia Condeixa-a-Nova')
    expect(shortStoreBrand('Continente Bom Dia Condeixa-a-Nova')).toBe('Continente')
    expect(shortStoreBrand('Intermarché Condeixa')).toBe('Intermarché')
    expect(formatDespensaPriceLabel(2.25, desc)).toBe('€2.25/kg')
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

  it('stores and reads NomeCurto and UnitGrams', () => {
    const desc = buildDespensaDescription(6, 1.50, {
      nomeCurto: 'Atum',
      unitGrams: 120,
    })
    expect(getNomeCurtoFromDesc(desc)).toBe('Atum')
    expect(getUnitGramsFromDesc(desc)).toBe(120)
    expect(cookingName('Atum Continente 120g', desc)).toBe('Atum')
    expect(cookingName('Ovos', '[BuyAmount]\n6')).toBe('Ovos')
    expect(
      ingredientDisplayName(
        'COGUMELOS LAM 250G',
        buildDespensaDescription(1, 1, { generico: 'Cogumelos', nomeCurto: 'Cogumelo' })
      )
    ).toBe('Cogumelos')
  })

  it('preserves NomeCurto and UnitGrams when rebuilding', () => {
    const existing = buildDespensaDescription(1, 2, {
      nomeCurto: 'Ovo',
      unitGrams: 55,
    })
    const next = buildDespensaDescription(6, 2.5, { existingDescription: existing })
    expect(getNomeCurtoFromDesc(next)).toBe('Ovo')
    expect(getUnitGramsFromDesc(next)).toBe(55)
    expect(getBuyAmountFromDesc(next)).toBe(6)
  })
})

describe('consumption ranking', () => {
  it('ranks higher daily consumption first', () => {
    const maca = [
      consume(1, 1, '2026-01-01 10:00:00'),
      consume(1, 1, '2026-01-11 10:00:00'), // 2 over 10 days → 0.2/day
    ]
    const pao = [
      consume(2, 1, '2026-01-01 10:00:00'),
      consume(2, 1, '2026-01-03 10:00:00'), // 2 over 2 days → 1/day
    ]
    expect(consumptionScore(pao)).toBeGreaterThan(consumptionScore(maca))

    const sorted = sortByConsumption(
      [
        { product_id: 1, product: { name: 'Maçã' } },
        { product_id: 2, product: { name: 'Pão' } },
      ],
      { 1: maca, 2: pao }
    )
    expect(sorted.map((i) => i.product.name)).toEqual(['Pão', 'Maçã'])
  })

  it('puts never-consumed items last', () => {
    const sorted = sortByConsumption(
      [
        { product_id: 1, product: { name: 'Água' } },
        { product_id: 2, product: { name: 'Pão' } },
      ],
      {
        2: [consume(2, 1, '2026-01-01 10:00:00'), consume(2, 1, '2026-01-05 10:00:00')],
      }
    )
    expect(sorted.map((i) => i.product.name)).toEqual(['Pão', 'Água'])
  })
})

describe('inferUnitGramsFromName', () => {
  it('reads pack weight from SKU / talão names', () => {
    expect(inferUnitGramsFromName('COGUMELOS LAMINADOS CNT 185GR')).toBe(185)
    expect(inferUnitGramsFromName('COGUMELOS DESP. CLASSICA 185G')).toBe(185)
    expect(inferUnitGramsFromName('COGUMELOS LAM 250G CNT')).toBe(250)
    expect(inferUnitGramsFromName('AÇÚCAR 1KG')).toBe(1000)
    expect(inferUnitGramsFromName('FARINHA 0,5KG')).toBe(500)
  })

  it('skips NxM multipliers and empty names', () => {
    expect(inferUnitGramsFromName('HAMBURGUER PORCO CNT 10x50G')).toBeNull()
    expect(inferUnitGramsFromName('IOGURTE 4X125G')).toBeNull()
    expect(inferUnitGramsFromName('BANANA')).toBeNull()
  })

  it('prefers the first name that has a pack weight', () => {
    expect(inferUnitGramsFromNames('Cogumelos', 'COGUMELOS LAM 185G')).toBe(185)
  })
})
