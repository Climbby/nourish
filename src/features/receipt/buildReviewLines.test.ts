import { describe, expect, it } from 'vitest'
import type { Product } from '../../types/grocy'
import { buildReviewLines } from './buildReviewLines'
import type { ReceiptLine } from './types'

function product(id: number, name: string): Product {
  return {
    id,
    name,
    description: null,
    product_group_id: 6,
    qu_id_stock: 1,
    qu_id_purchase: 1,
    picture_file_name: null,
    calories: null,
  }
}

function line(name: string): ReceiptLine {
  return { raw: name, name, qty: 1, unitPrice: 1, lineTotal: 1 }
}

describe('buildReviewLines ignore list', () => {
  it('starts blacklisted names unchecked', () => {
    const rows = buildReviewLines(
      [line('SACO LIXO 30L'), line('LEITE UHT')],
      [product(1, 'Leite UHT')],
      ['saco lixo 30l']
    )
    expect(rows.find((r) => r.receiptLine.name === 'SACO LIXO 30L')?.included).toBe(false)
    expect(rows.find((r) => r.receiptLine.name === 'LEITE UHT')?.included).toBe(true)
  })
})
