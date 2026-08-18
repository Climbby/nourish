import { describe, expect, it } from 'vitest'
import type { Product, StockLogEntry } from '../types/grocy'
import { buildDespensaDescription } from './despensaAnalytics'
import {
  aggregateFamilyPurchases,
  findGenericoSiblings,
  mergeStorePriceItems,
  nextSiblingId,
  sortFamilyVariants,
} from './productFamily'
import type { StorePriceItem } from './storePrices'

function product(
  id: number,
  name: string,
  opts?: { desc?: string | null; picture?: string | null; active?: number }
): Product {
  return {
    id,
    name,
    description: opts?.desc ?? null,
    product_group_id: 1,
    location_id: 1,
    qu_id_purchase: 1,
    qu_id_stock: 1,
    picture_file_name: opts?.picture ?? null,
    calories: null,
    active: opts?.active ?? 1,
  } as Product
}

function purchase(id: number, productId: number, price: number, ts: string): StockLogEntry {
  return {
    id,
    product_id: productId,
    amount: 1,
    price,
    transaction_type: 'purchase',
    transaction_id: `t${id}`,
    undone: 0,
    row_created_timestamp: ts,
  } as StockLogEntry
}

describe('findGenericoSiblings', () => {
  it('returns only the product when Generico is missing', () => {
    const p = product(1, 'Água')
    expect(findGenericoSiblings([p, product(2, 'Leite')], p)).toEqual([p])
  })

  it('groups case/accent-insensitive Generico siblings', () => {
    const g1 = buildDespensaDescription(1, 1.9, { generico: 'Cogumelos' })
    const g2 = buildDespensaDescription(1, 2.2, { generico: 'cogumelos' })
    const a = product(1, 'Cogumelos Continente', { desc: g1, picture: 'a.webp' })
    const b = product(2, 'Cogumelos Auchan', { desc: g2 })
    const other = product(3, 'Leite', {
      desc: buildDespensaDescription(1, 1, { generico: 'Leite' }),
    })
    const siblings = findGenericoSiblings([a, b, other], a)
    expect(siblings.map((p) => p.id)).toEqual([1, 2])
  })

  it('ignores inactive products and unique Generico', () => {
    const g = buildDespensaDescription(1, 1, { generico: 'Atum' })
    const a = product(1, 'Atum A', { desc: g })
    const inactive = product(2, 'Atum B', { desc: g, active: 0 })
    expect(findGenericoSiblings([a, inactive], a)).toEqual([a])
  })
})

describe('sortFamilyVariants', () => {
  it('lists photo variants before those without, then by name', () => {
    const sorted = sortFamilyVariants([
      product(1, 'Zebra', { picture: 'z.webp' }),
      product(2, 'Ameixa'),
      product(3, 'Manga', { picture: 'm.webp' }),
    ])
    expect(sorted.map((p) => p.name)).toEqual(['Manga', 'Zebra', 'Ameixa'])
  })
})

describe('nextSiblingId', () => {
  const ids = [{ id: 1 }, { id: 2 }, { id: 3 }]

  it('returns the next sibling after the removed SKU', () => {
    expect(nextSiblingId(ids, 1)).toBe(2)
    expect(nextSiblingId(ids, 2)).toBe(3)
  })

  it('returns the previous sibling when the last SKU is removed', () => {
    expect(nextSiblingId(ids, 3)).toBe(2)
  })

  it('returns null when no siblings remain', () => {
    expect(nextSiblingId([{ id: 7 }], 7)).toBeNull()
    expect(nextSiblingId([], 1)).toBeNull()
  })
})

describe('aggregateFamilyPurchases', () => {
  it('merges purchases from sibling SKUs newest-first', () => {
    const logs = [
      purchase(1, 10, 1.9, '2026-03-01 10:00:00'),
      purchase(2, 11, 2.1, '2026-04-01 10:00:00'),
      {
        ...purchase(3, 10, 0, '2026-05-01 10:00:00'),
        transaction_type: 'consume',
      },
      { ...purchase(4, 11, 3, '2026-02-01 10:00:00'), undone: 1 },
    ]
    const purchases = aggregateFamilyPurchases(logs, 10)
    expect(purchases.map((p) => p.price)).toEqual([2.1, 1.9])
    expect(purchases.map((p) => p.product_id)).toEqual([11, 10])
  })
})

describe('mergeStorePriceItems', () => {
  it('dedupes by observation id across sibling fetches', () => {
    const a: StorePriceItem = {
      id: 'x1',
      store_id: 's1',
      store_label: 'Continente',
      product_name: 'A',
      product_id: 1,
      unit_price: 1.9,
      qty: 1,
      observed_at: '2026-03-01T12:00:00.000Z',
      source: 'receipt',
    }
    const b: StorePriceItem = { ...a, id: 'x2', product_id: 2, unit_price: 2.2 }
    const merged = mergeStorePriceItems([[a, b], [a]])
    expect(merged).toHaveLength(2)
    expect(merged.map((p) => p.id).sort()).toEqual(['x1', 'x2'])
  })
})
