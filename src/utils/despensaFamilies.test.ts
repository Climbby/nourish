import { describe, expect, it } from 'vitest'
import type { StockItem, StockLogEntry } from '../types/grocy'
import { buildDespensaDescription } from './despensaAnalytics'
import {
  filterFamiliesWithPhotos,
  groupDespensaFamilies,
  sortFamiliesByConsumption,
} from './despensaFamilies'

function stock(
  id: number,
  name: string,
  opts?: { desc?: string | null; amount?: number; picture?: string | null }
): StockItem {
  return {
    product_id: id,
    amount: opts?.amount ?? 1,
    value: 0,
    product: {
      id,
      name,
      description: opts?.desc ?? null,
      product_group_id: 1,
      location_id: 1,
      qu_id_purchase: 1,
      qu_id_stock: 1,
      picture_file_name: opts?.picture ?? null,
      calories: null,
      active: 1,
    },
  } as StockItem
}

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

describe('groupDespensaFamilies variant order', () => {
  it('keeps variants in the same Generico family', () => {
    const g = buildDespensaDescription(1, 1, { generico: 'Cogumelos' })
    const families = groupDespensaFamilies([
      stock(1, 'Cogumelos Continente', { desc: g, picture: 'a.webp' }),
      stock(2, 'Cogumelos Auchan', { desc: g }),
      stock(3, 'Leite'),
    ])
    expect(families).toHaveLength(2)
    const mushrooms = families.find((f) => f.title === 'Cogumelos')!
    expect(mushrooms.variants.map((v) => v.product.name)).toEqual([
      'Cogumelos Continente',
      'Cogumelos Auchan',
    ])
  })

  it('uses the starred variant as the family primary', () => {
    const g = buildDespensaDescription(1, 1, { generico: 'Cogumelos' })
    const families = groupDespensaFamilies(
      [
        stock(1, 'Cogumelos Continente', { desc: g, picture: 'a.webp', amount: 2 }),
        stock(2, 'Cogumelos Auchan', { desc: g, amount: 1 }),
      ],
      { cogumelos: 2 }
    )
    expect(families).toHaveLength(1)
    expect(families[0].primary.product_id).toBe(2)
  })
})

describe('sortFamiliesByConsumption', () => {
  it('lists families with a photo first, then by consumption and title', () => {
    const families = groupDespensaFamilies([
      stock(1, 'Água'),
      stock(2, 'Pão', { picture: 'pao.webp' }),
      stock(3, 'Leite', { picture: 'leite.webp' }),
      stock(4, 'Arroz'),
    ])
    const logs = {
      1: [consume(1, 1, '2026-01-01 10:00:00'), consume(1, 1, '2026-01-02 10:00:00')],
      2: [consume(2, 1, '2026-01-01 10:00:00'), consume(2, 1, '2026-01-11 10:00:00')],
    }
    const sorted = sortFamiliesByConsumption(families, logs)
    expect(sorted.map((f) => f.title)).toEqual(['Pão', 'Leite', 'Água', 'Arroz'])
  })
})

describe('filterFamiliesWithPhotos', () => {
  it('drops families with no photos and keeps only photo variants', () => {
    const g = buildDespensaDescription(1, 1, { generico: 'Cogumelos' })
    const families = groupDespensaFamilies([
      stock(1, 'Cogumelos Continente', { desc: g, picture: 'a.webp', amount: 2 }),
      stock(2, 'Cogumelos Auchan', { desc: g, amount: 1 }),
      stock(3, 'Água'),
      stock(4, 'Pão', { picture: 'pao.webp' }),
    ])
    const filtered = filterFamiliesWithPhotos(families)
    expect(filtered.map((f) => f.title).sort()).toEqual(['Cogumelos', 'Pão'])
    const mushrooms = filtered.find((f) => f.title === 'Cogumelos')!
    expect(mushrooms.variants).toHaveLength(1)
    expect(mushrooms.variants[0].product.name).toBe('Cogumelos Continente')
    expect(mushrooms.totalAmount).toBe(2)
  })
})
