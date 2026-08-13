import { describe, expect, it } from 'vitest'
import {
  appendStorePrices,
  listLatestByProduct,
  loadStorePrices,
  productHistory,
  storeSummary,
  withCanonicalStores,
} from './store-prices.mjs'

describe('store-prices', () => {
  const sample = [
    {
      id: '1',
      store_id: 'zone.auchan',
      store_label: 'Auchan',
      product_name: 'Leite',
      product_id: 10,
      unit_price: 0.89,
      qty: 1,
      observed_at: '2026-01-01T10:00:00.000Z',
      source: 'receipt',
    },
    {
      id: '2',
      store_id: 'zone.auchan',
      store_label: 'Auchan',
      product_name: 'Leite',
      product_id: 10,
      unit_price: 0.95,
      qty: 1,
      observed_at: '2026-02-01T10:00:00.000Z',
      source: 'receipt',
    },
    {
      id: '3',
      store_id: 'zone.continente',
      store_label: 'Continente',
      product_name: 'Pão',
      product_id: 11,
      unit_price: 1.2,
      qty: 1,
      observed_at: '2026-02-01T11:00:00.000Z',
      source: 'receipt',
    },
  ]

  it('keeps latest price per store+product', () => {
    const latest = listLatestByProduct(sample)
    const leite = latest.find((r) => r.product_id === 10)
    expect(leite?.unit_price).toBe(0.95)
  })

  it('returns history sorted ascending', () => {
    const hist = productHistory(sample, { product_id: 10 })
    expect(hist.map((h) => h.unit_price)).toEqual([0.89, 0.95])
  })

  it('summarises stores', () => {
    const summary = storeSummary(sample)
    expect(summary).toHaveLength(2)
    expect(summary.find((s) => s.store_id === 'zone.auchan')?.product_count).toBe(1)
  })

  it('merges receipt.brand into zone for the same brand', () => {
    const mixed = [
      {
        id: 'a',
        store_id: 'receipt.continente',
        store_label: 'Continente',
        product_name: 'MACA FUJI',
        product_id: 23,
        unit_price: 2.25,
        qty: 0.48,
        observed_at: '2026-07-25T11:00:00.000Z',
        source: 'receipt',
      },
      {
        id: 'b',
        store_id: 'zone.continente_bom_dia_condeixa_a_nova',
        store_label: 'Continente Bom Dia Condeixa-a-Nova',
        product_name: 'SAL',
        product_id: 27,
        unit_price: 0.79,
        qty: 1,
        observed_at: '2026-07-25T11:00:00.000Z',
        source: 'receipt',
      },
    ]
    const canon = withCanonicalStores(mixed)
    expect(canon.every((r) => r.store_id === 'zone.continente_bom_dia_condeixa_a_nova')).toBe(true)
    expect(storeSummary(mixed)).toHaveLength(1)
    expect(listLatestByProduct(mixed)).toHaveLength(2)
  })

  it('matches history by product name when product_id is null', () => {
    const rows = [
      {
        id: '1',
        store_id: 'zone.continente_bom_dia',
        store_label: 'Continente',
        product_name: 'SAL LOICA CONTINENTE 2 KG',
        product_id: null,
        unit_price: 0.79,
        qty: 1,
        observed_at: '2026-07-25T11:00:00.000Z',
        source: 'receipt',
      },
    ]
    const hist = productHistory(rows, {
      product_id: 27,
      product_name: 'SAL LOICA CONTINENTE 2 KG',
    })
    expect(hist).toHaveLength(1)
  })

  it('appends and loads jsonl', () => {
    let buf = ''
    appendStorePrices([sample[0]], (_p, data) => {
      buf += data
    })
    const loaded = loadStorePrices(() => buf)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].product_name).toBe('Leite')
  })
})
