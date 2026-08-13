import { describe, expect, it } from 'vitest'
import type { Product, Recipe } from '../types/grocy'
import {
  buildPartRecipeDescription,
  DEFAULT_GRAMS_FOR_ROLE,
  despensaCandidates,
  isPartRecipeRole,
} from './createPartRecipe'
import { parseDescription } from './parseDescription'
import { makeProductMacroLookup } from './recipeNutrition'

function product(id: number, name: string, description: string | null = null): Product {
  return {
    id,
    name,
    description,
    product_group_id: 6,
    qu_id_stock: 2,
    qu_id_purchase: 2,
    picture_file_name: null,
    calories: null,
  }
}

function recipe(id: number, name: string): Recipe {
  return {
    id,
    name,
    description: '',
    base_servings: 1,
    desired_servings: 1,
    not_check_shoppinglist: 0,
    picture_file_name: null,
    type: 'normal',
  }
}

describe('buildPartRecipeDescription', () => {
  it('stamps the category that gives the recipe its role', () => {
    const desc = buildPartRecipeDescription('Maçã', 'sobremesa', 150)
    expect(parseDescription(desc).category).toBe('Sobremesa')
  })

  it('writes one ingredient carrying the serving size', () => {
    const desc = buildPartRecipeDescription('Maçã', 'sobremesa', 150)
    const { ingredientItems } = parseDescription(desc)
    expect(ingredientItems).toHaveLength(1)
    expect(ingredientItems[0].name).toBe('Maçã')
    expect(ingredientItems[0].grams).toBe(150)
  })

  it('leaves the price blank for later', () => {
    expect(parseDescription(buildPartRecipeDescription('Água', 'bebida', 250)).price).toBeNull()
  })

  it('omits the grams field when the serving size is cleared', () => {
    const { ingredientItems } = parseDescription(buildPartRecipeDescription('Água', 'bebida', 0))
    expect(ingredientItems[0].name).toBe('Água')
    expect(ingredientItems[0].grams).toBeNull()
  })

  it('keeps the name exact so product macros derive on the first try', () => {
    const products = [
      product(1, 'Maçã', '[Nutricao100]\ncalories:52\nprotein:0.3\ncarbs:14\nfat:0.2\nsource:insa'),
    ]
    const lookup = makeProductMacroLookup(products)
    const { ingredientItems } = parseDescription(
      buildPartRecipeDescription(products[0].name, 'sobremesa', 150)
    )
    expect(lookup(ingredientItems[0].name)?.calories).toBe(52)
  })

  it('trims the product name without altering its accents', () => {
    const { ingredientItems } = parseDescription(
      buildPartRecipeDescription('  Iogurte natural  ', 'sobremesa', 125)
    )
    expect(ingredientItems[0].name).toBe('Iogurte natural')
  })
})

describe('DEFAULT_GRAMS_FOR_ROLE', () => {
  it('prefills a real serving per role', () => {
    expect(DEFAULT_GRAMS_FOR_ROLE).toEqual({ sopa: 300, sobremesa: 150, bebida: 250 })
  })

  it('excludes prato — a main dish is never a single pantry product', () => {
    expect(isPartRecipeRole('prato')).toBe(false)
    expect(isPartRecipeRole('sopa')).toBe(true)
  })
})

describe('despensaCandidates', () => {
  it('hides products that already have a recipe', () => {
    const products = [product(1, 'Maçã'), product(2, 'Banana')]
    const names = despensaCandidates(products, [recipe(9, 'Maçã')]).map((p) => p.name)
    expect(names).toEqual(['Banana'])
  })

  it('matches names ignoring case and accents', () => {
    const products = [product(1, 'Maçã'), product(2, 'Água')]
    const existing = [recipe(9, 'MACA'), recipe(10, 'agua')]
    expect(despensaCandidates(products, existing)).toEqual([])
  })

  it('ignores stray whitespace on either side of the match', () => {
    const products = [product(1, 'Sumo  de   laranja')]
    expect(despensaCandidates(products, [recipe(9, 'sumo de laranja')])).toEqual([])
  })

  it('sorts alphabetically in Portuguese', () => {
    const products = [product(1, 'Água'), product(2, 'Abacate'), product(3, 'Banana')]
    expect(despensaCandidates(products, []).map((p) => p.name)).toEqual([
      'Abacate',
      'Água',
      'Banana',
    ])
  })
})
