import { describe, expect, it } from 'vitest'
import type { IngredientLine } from './parseDescription'
import {
  deriveRecipeNutrition,
  getMacrosFromDesc,
  isNutritionComplete,
  upsertMacrosSection,
  type ProductMacros,
} from './productNutrition'

const atum: ProductMacros = {
  calories: 116,
  protein: 26,
  carbs: 0,
  fat: 1,
  fibre: 0,
  source: 'rotulo',
}

const massa: ProductMacros = {
  calories: 350,
  protein: 12,
  carbs: 70,
  fat: 1.5,
  fibre: 3,
  source: 'insa',
}

describe('product macros storage', () => {
  it('round-trips a macros block', () => {
    const desc = upsertMacrosSection(null, atum)
    expect(getMacrosFromDesc(desc)).toEqual(atum)
  })

  it('preserves other sections when writing macros', () => {
    const existing = '[BuyAmount]\n6\n\n[Preco]\n1.50'
    const desc = upsertMacrosSection(existing, atum)
    expect(desc).toContain('[BuyAmount]\n6')
    expect(desc).toContain('[Preco]\n1.50')
    expect(getMacrosFromDesc(desc)).toEqual(atum)
  })

  it('replaces rather than duplicates an existing block', () => {
    const once = upsertMacrosSection('[BuyAmount]\n6', atum)
    const twice = upsertMacrosSection(once, massa)
    expect(twice.match(/\[Nutricao100\]/g)).toHaveLength(1)
    expect(getMacrosFromDesc(twice)).toEqual(massa)
    expect(twice).toContain('[BuyAmount]\n6')
  })

  it('removes the block when passed null', () => {
    const desc = upsertMacrosSection('[BuyAmount]\n6', atum)
    const cleared = upsertMacrosSection(desc, null)
    expect(getMacrosFromDesc(cleared)).toBeNull()
    expect(cleared).toContain('[BuyAmount]\n6')
  })

  it('treats a missing or all-zero block as absent', () => {
    expect(getMacrosFromDesc(null)).toBeNull()
    expect(getMacrosFromDesc('[BuyAmount]\n6')).toBeNull()
    expect(
      getMacrosFromDesc('[Nutricao100]\ncalories:0\nprotein:0\ncarbs:0\nfat:0\nfibre:0\nsource:manual')
    ).toBeNull()
  })

  it('defaults an unknown source to manual', () => {
    const desc = '[Nutricao100]\ncalories:100\nprotein:5\ncarbs:0\nfat:0\nfibre:0\nsource:bogus'
    expect(getMacrosFromDesc(desc)?.source).toBe('manual')
  })
})

describe('deriveRecipeNutrition', () => {
  const lookup = (name: string): ProductMacros | null => {
    if (name === 'Atum') return atum
    if (name === 'Esparguete') return massa
    return null
  }

  it('sums ingredient macros and divides by portions', () => {
    const ingredients: IngredientLine[] = [
      { name: 'Atum', price: 1.5, grams: 160 },
      { name: 'Esparguete', price: 0.8, grams: 200 },
    ]
    const derived = deriveRecipeNutrition(ingredients, lookup, 2)

    // Atum: 1.6 × (116, 26) = (185.6, 41.6); Massa: 2 × (350, 12) = (700, 24)
    // Totals (885.6, 65.6) ÷ 2 portions
    expect(derived.calories).toBe(443)
    expect(derived.protein).toBe(32.8)
    expect(derived.resolved).toBe(2)
    expect(isNutritionComplete(derived)).toBe(true)
  })

  it('returns whole-recipe totals when portions are unknown', () => {
    const ingredients: IngredientLine[] = [{ name: 'Atum', price: null, grams: 100 }]
    expect(deriveRecipeNutrition(ingredients, lookup, null).calories).toBe(116)
    expect(deriveRecipeNutrition(ingredients, lookup, 0).calories).toBe(116)
  })

  it('reports ingredients that block a trustworthy total', () => {
    const ingredients: IngredientLine[] = [
      { name: 'Atum', price: 1.5, grams: 100 },
      { name: 'Cebola', price: 0.2, grams: 80 },
      { name: 'Sal', price: null, grams: null },
    ]
    const derived = deriveRecipeNutrition(ingredients, lookup, 1)

    expect(derived.missingMacros).toEqual(['Cebola'])
    expect(derived.missingGrams).toEqual(['Sal'])
    expect(derived.resolved).toBe(1)
    expect(isNutritionComplete(derived)).toBe(false)
  })

  it('is not complete when nothing resolved', () => {
    expect(isNutritionComplete(deriveRecipeNutrition([], lookup, 2))).toBe(false)
  })

  it('ignores blank ingredient names with no quantity', () => {
    const derived = deriveRecipeNutrition([{ name: '  ', price: null, grams: null }], lookup, 1)
    expect(derived.missingGrams).toEqual([])
  })

  it('skips ignored ingredients for grams, macros, and completeness', () => {
    const ingredients: IngredientLine[] = [
      { name: 'Atum', price: 1.5, grams: 100 },
      { name: 'Sal', price: null, grams: null, ignorePrice: true },
    ]
    const derived = deriveRecipeNutrition(ingredients, lookup, 1)
    expect(derived.missingGrams).toEqual([])
    expect(derived.missingMacros).toEqual([])
    expect(derived.resolved).toBe(1)
    expect(derived.calories).toBe(116)
    expect(isNutritionComplete(derived)).toBe(true)
  })
})
