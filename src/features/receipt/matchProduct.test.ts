import { beforeEach, describe, expect, it } from 'vitest'
import { editDistance, fuzzyNameEqual } from './editDistance'
import { getAliasProductId, setAlias } from './receiptAliases'
import { findBestProductMatch } from './matchProduct'
import type { Product } from '../../types/grocy'

describe('editDistance / fuzzyNameEqual', () => {
  it('matches small typos', () => {
    expect(editDistance('cerais', 'cereais')).toBe(1)
    expect(fuzzyNameEqual('cerais', 'cereais')).toBe(true)
    expect(fuzzyNameEqual('NGORDO', 'MGORDO')).toBe(true)
    expect(fuzzyNameEqual('leite', 'agua')).toBe(false)
  })
})

describe('receiptAliases fuzzy', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('resolves alias within edit distance 2', () => {
    setAlias('leite uht mgordo', 42)
    expect(getAliasProductId('leite uht ngordo')).toBe(42)
    expect(getAliasProductId('leite uht mgordo')).toBe(42)
  })
})

describe('findBestProductMatch edit distance', () => {
  const products: Product[] = [
    {
      id: 1,
      name: 'Cereais',
      description: null,
      product_group_id: 1,
      qu_id_stock: 1,
      qu_id_purchase: 1,
      picture_file_name: null,
      calories: null,
    },
    {
      id: 2,
      name: 'Leite',
      description: null,
      product_group_id: 1,
      qu_id_stock: 1,
      qu_id_purchase: 1,
      picture_file_name: null,
      calories: null,
    },
  ]

  it('matches cerais to Cereais', () => {
    const m = findBestProductMatch('cerais', products)
    expect(m?.productId).toBe(1)
    expect(m!.score).toBeGreaterThanOrEqual(0.45)
  })
})
