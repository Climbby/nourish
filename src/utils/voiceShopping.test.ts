import { describe, expect, it } from 'vitest'
import type { Product, ShoppingListItem } from '../types/grocy'
import { buildDespensaDescription } from './despensaAnalytics'
import {
  alreadyOnShoppingList,
  classifyHeardShoppingNames,
  dismissHeardKey,
  voiceShoppingKeeps,
} from './voiceShopping'

function product(id: number, name: string, description: string | null): Product {
  return {
    id,
    name,
    description,
    product_group_id: 6,
    qu_id_stock: 1,
    qu_id_purchase: 1,
    picture_file_name: null,
    calories: null,
    active: 1,
  }
}

const catalog: Product[] = [
  product(1, 'ATUM CONTINENTE 120G', buildDespensaDescription(1, 1.1, { nomeCurto: 'Atum', generico: 'Atum' })),
  product(2, 'OVOS M CONTINENTE', buildDespensaDescription(6, 1.8, { nomeCurto: 'Ovos', generico: 'Ovos' })),
  product(3, 'LEITE UHT MEIO GORDO 1L', buildDespensaDescription(1, 0.8, { nomeCurto: 'Leite', generico: 'Leite' })),
]

describe('classifyHeardShoppingNames', () => {
  it('links exact-ish Despensa hits and leaves unknown names unlinked', () => {
    const items = classifyHeardShoppingNames(['Atum', 'ovos', 'saco do lixo'], catalog)
    expect(items.map((i) => [i.heardName, i.status, i.product?.id])).toEqual([
      ['Atum', 'linked', 1],
      ['ovos', 'linked', 2],
      ['saco do lixo', 'unlinked', undefined],
    ])
    const keep = voiceShoppingKeeps(items)
    expect(keep.linked.map((i) => i.product!.id)).toEqual([1, 2])
    expect(keep.unlinked.map((i) => i.heardName)).toEqual(['saco do lixo'])
  })

  it('does not fuzzy-match a different food', () => {
    const items = classifyHeardShoppingNames(['atumada', 'natas'], catalog)
    expect(items.every((i) => i.status === 'unlinked' && i.product == null)).toBe(true)
  })

  it('drops a dismissed guess so it is not added', () => {
    const dismissed = dismissHeardKey([], 'saco do lixo')
    const items = classifyHeardShoppingNames(
      ['leite', 'saco do lixo'],
      catalog,
      { dismissedKeys: dismissed }
    )
    expect(items.find((i) => i.key.includes('saco'))?.status).toBe('dismissed')
    const keep = voiceShoppingKeeps(items)
    expect(keep.linked.map((i) => i.product!.id)).toEqual([3])
    expect(keep.unlinked).toEqual([])
  })

  it('skips auto-link for talão ignore names but still keeps them unlinked', () => {
    const items = classifyHeardShoppingNames(['atum', 'saco do lixo'], catalog, {
      ignoreList: ['atum', 'saco do lixo'],
    })
    expect(items.find((i) => i.heardName === 'atum')?.status).toBe('unlinked')
    expect(items.find((i) => i.heardName === 'saco do lixo')?.status).toBe('unlinked')
    const keep = voiceShoppingKeeps(items)
    expect(keep.linked).toEqual([])
    expect(keep.unlinked.map((i) => i.heardName)).toEqual(['atum', 'saco do lixo'])
  })
})

describe('alreadyOnShoppingList', () => {
  it('detects a linked product already on the list', () => {
    const [atum] = classifyHeardShoppingNames(['Atum'], catalog)
    const existing: ShoppingListItem[] = [
      { id: 9, product_id: 1, amount: 1, note: null, done: 0 },
    ]
    expect(alreadyOnShoppingList(atum, existing)).toBe(true)
  })

  it('detects the same unlinked note', () => {
    const [bag] = classifyHeardShoppingNames(['saco do lixo'], catalog)
    const existing: ShoppingListItem[] = [
      { id: 4, product_id: null, amount: 1, note: 'Saco do lixo', done: 0 },
    ]
    expect(alreadyOnShoppingList(bag, existing)).toBe(true)
  })
})
