import { describe, expect, it } from 'vitest'
import {
  filterGenericoSuggestions,
  listKnownGenericos,
  suggestGenericoForName,
} from './genericoSuggestions'
import {
  buildDespensaDescription,
  despensaDisplayName,
  familyKey,
  getGenericoFromDesc,
} from './despensaAnalytics'
import { groupDespensaFamilies } from './despensaFamilies'
import type { StockItem } from '../types/grocy'

describe('Generico description', () => {
  it('stores and reads [Generico]', () => {
    const desc = buildDespensaDescription(1, 1.5, { generico: 'Cogumelos' })
    expect(getGenericoFromDesc(desc)).toBe('Cogumelos')
    expect(despensaDisplayName('Cogumelos Continente 250g', desc)).toBe('Cogumelos')
    expect(familyKey('Cogumelos Continente 250g', desc)).toBe(
      familyKey('other', buildDespensaDescription(1, null, { generico: 'cogumelos' }))
    )
  })

  it('preserves Generico when rebuilding', () => {
    const existing = buildDespensaDescription(1, 2, { generico: 'Atum' })
    const next = buildDespensaDescription(6, 2.5, { existingDescription: existing })
    expect(getGenericoFromDesc(next)).toBe('Atum')
  })
})

describe('genericoSuggestions', () => {
  const products = [
    {
      name: 'Cogumelos laminados Continente 250g',
      description: buildDespensaDescription(1, 1.2, { generico: 'Cogumelos' }),
    },
    {
      name: 'Atum em óleo Continente',
      description: buildDespensaDescription(6, 1.5, { nomeCurto: 'Atum' }),
    },
  ]

  it('lists known Generico and cooking names', () => {
    const known = listKnownGenericos(products)
    expect(known).toContain('Cogumelos')
    expect(known).toContain('Atum')
  })

  it('suggests existing family for receipt SKU', () => {
    const known = listKnownGenericos(products)
    const hit = suggestGenericoForName('COGUMELOS LAM CONTINENTE', known)
    expect(hit?.label).toBe('Cogumelos')
  })

  it('filters autocomplete', () => {
    expect(filterGenericoSuggestions('cog', ['Cogumelos', 'Atum', 'Leite'])).toEqual(['Cogumelos'])
  })
})

describe('groupDespensaFamilies', () => {
  function stock(id: number, name: string, desc: string | null, amount = 1): StockItem {
    return {
      product_id: id,
      amount,
      amount_aggregated: amount,
      amount_opened: 0,
      amount_opened_aggregated: 0,
      is_aggregated_amount: false,
      best_before_date: null,
      value: 0,
      product: {
        id,
        name,
        description: desc,
        product_group_id: 1,
        location_id: 1,
        qu_id_purchase: 1,
        qu_id_stock: 1,
        picture_file_name: null,
        calories: null,
        active: 1,
      },
    } as StockItem
  }

  it('groups variants by Generico', () => {
    const g = buildDespensaDescription(1, 1, { generico: 'Cogumelos' })
    const families = groupDespensaFamilies([
      stock(1, 'Cogumelos Continente', g),
      stock(2, 'Cogumelos Auchan', g),
      stock(3, 'Leite', null),
    ])
    expect(families).toHaveLength(2)
    const mushrooms = families.find((f) => f.title === 'Cogumelos')!
    expect(mushrooms.variants).toHaveLength(2)
    expect(mushrooms.totalAmount).toBe(2)
  })
})
