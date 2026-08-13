import { describe, expect, it } from 'vitest'
import type { Product } from '../types/grocy'
import { upsertMacrosSection, type ProductMacros } from './productNutrition'
import { makeProductMacroLookup, productsMissingMacros } from './recipeNutrition'

const atum: ProductMacros = {
  calories: 116,
  protein: 26,
  carbs: 0,
  fat: 1,
  fibre: 0,
  source: 'rotulo',
}

function product(id: number, name: string, macros: ProductMacros | null): Product {
  return {
    id,
    name,
    description: macros ? upsertMacrosSection('[BuyAmount]\n1', macros) : '[BuyAmount]\n1',
    product_group_id: null,
    qu_id_stock: 1,
    qu_id_purchase: 1,
    picture_file_name: null,
    calories: null,
  }
}

describe('makeProductMacroLookup', () => {
  const products = [
    product(1, 'Atum', atum),
    product(2, 'Cebola', null),
  ]

  it('matches ignoring case and accents', () => {
    const lookup = makeProductMacroLookup(products)
    expect(lookup('Atum')).toEqual(atum)
    expect(lookup('atum')).toEqual(atum)
    expect(lookup('  ATUM  ')).toEqual(atum)
  })

  it('matches accented names in either direction', () => {
    const lookup = makeProductMacroLookup([product(1, 'Açúcar', atum)])
    expect(lookup('acucar')).toEqual(atum)
    expect(lookup('Açúcar')).toEqual(atum)
  })

  it('returns null for products without macros', () => {
    expect(makeProductMacroLookup(products)('Cebola')).toBeNull()
  })

  it('does not fuzzy-match a different product', () => {
    const lookup = makeProductMacroLookup(products)
    expect(lookup('Atum em azeite')).toBeNull()
    expect(lookup('Atun')).toBeNull()
  })

  it('keeps the first product when names collide', () => {
    const other: ProductMacros = { ...atum, calories: 999 }
    const lookup = makeProductMacroLookup([product(1, 'Atum', atum), product(2, 'atum', other)])
    expect(lookup('Atum')?.calories).toBe(116)
  })

  it('matches NomeCurto as well as the full product name', () => {
    const p = product(
      1,
      'Atum Continente natural 120g',
      atum
    )
    p.description = upsertMacrosSection(
      '[BuyAmount]\n1\n\n[NomeCurto]\nAtum',
      atum
    )
    const lookup = makeProductMacroLookup([p])
    expect(lookup('Atum')).toEqual(atum)
    expect(lookup('Atum Continente natural 120g')).toEqual(atum)
  })
})

describe('productsMissingMacros', () => {
  it('lists only the products still to fill in', () => {
    const missing = productsMissingMacros([product(1, 'Atum', atum), product(2, 'Cebola', null)])
    expect(missing.map((p) => p.name)).toEqual(['Cebola'])
  })
})
