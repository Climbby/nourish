import { describe, expect, it } from 'vitest'
import type { Product } from '../types/grocy'
import {
  costForQuantity,
  filterProductsForIngredient,
  gramsForQuantity,
  hydrateIngredientFromProducts,
  resolveIngredientFromProduct,
} from './ingredientFromProduct'

function product(id: number, name: string, description: string): Product {
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

describe('gramsForQuantity / costForQuantity', () => {
  const lata =
    '[BuyAmount]\n1\n\n[Preco]\n1.20\n\n[UnitGrams]\n120\n\n[NomeCurto]\nAtum'

  it('converts count to grams', () => {
    expect(gramsForQuantity(lata, 2)).toBe(240)
    expect(gramsForQuantity('[BuyAmount]\n1', 2)).toBeNull()
  })

  it('costs pack price per unit for un products', () => {
    const pack =
      '[BuyAmount]\n6\n\n[Preco]\n1.80\n\n[UnitGrams]\n55\n\n[NomeCurto]\nOvo'
    // 2 eggs of a 6-pack at €1.80 → 0.60
    expect(costForQuantity(pack, 2)).toBe(0.6)
  })

  it('costs by weight for kg products', () => {
    const tomato =
      '[BuyAmount]\n1\n\n[Preco]\n2.00\n\n[PrecoUnit]\nkg\n\n[UnitGrams]\n150'
    // 1 tomato × 150 g × €2/kg → 0.30
    expect(costForQuantity(tomato, 1)).toBe(0.3)
  })
})

describe('resolveIngredientFromProduct', () => {
  it('fills cooking name, price and grams from count', () => {
    const p = product(
      3,
      'Atum Continente natural 120g',
      '[BuyAmount]\n1\n\n[Preco]\n1.20\n\n[UnitGrams]\n120\n\n[NomeCurto]\nAtum'
    )
    expect(resolveIngredientFromProduct(p, 2)).toEqual({
      name: 'Atum',
      price: '2.40',
      grams: '240',
      qty: '2',
      productId: 3,
      unitGrams: 120,
    })
  })
})

describe('filterProductsForIngredient', () => {
  const products = [
    product(1, 'Atum Continente 120g', '[BuyAmount]\n1\n\n[NomeCurto]\nAtum'),
    product(2, 'Ovos classe M', '[BuyAmount]\n6\n\n[NomeCurto]\nOvo'),
  ]

  it('matches NomeCurto and full name', () => {
    expect(filterProductsForIngredient('atu', products).map((p) => p.id)).toEqual([1])
    expect(filterProductsForIngredient('ovos', products).map((p) => p.id)).toEqual([2])
  })
})

describe('hydrateIngredientFromProducts', () => {
  it('relinks by NomeCurto and infers qty from grams', () => {
    const products = [
      product(
        1,
        'Atum Continente 120g',
        '[BuyAmount]\n1\n\n[UnitGrams]\n120\n\n[NomeCurto]\nAtum'
      ),
    ]
    expect(hydrateIngredientFromProducts('Atum', 240, products)).toEqual({
      name: 'Atum',
      productId: 1,
      unitGrams: 120,
      qty: '2',
    })
  })
})
