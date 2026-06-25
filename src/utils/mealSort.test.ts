import { describe, expect, it } from 'vitest'
import type { Recipe } from '../types/grocy'
import type { ParsedRecipe } from './parseDescription'
import { sortRecipes } from './mealSort'

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

function parsed(price: number | null): ParsedRecipe {
  return {
    ingredients: null,
    ingredientItems: [],
    steps: null,
    nutrition: null,
    price,
    category: null,
    portions: null,
    verified: [],
  }
}

describe('sortRecipes', () => {
  const recipes = [recipe(1, 'A'), recipe(3, 'C'), recipe(2, 'B')]
  const parsedById = new Map<number, ParsedRecipe>([
    [1, parsed(4)],
    [2, parsed(12)],
    [3, parsed(null)],
  ])

  it('sorts by most recent id first', () => {
    expect(sortRecipes(recipes, parsedById, 'recent').map((r) => r.id)).toEqual([3, 2, 1])
  })

  it('sorts by oldest id first', () => {
    expect(sortRecipes(recipes, parsedById, 'oldest').map((r) => r.id)).toEqual([1, 2, 3])
  })

  it('sorts by highest price first, missing price last', () => {
    expect(sortRecipes(recipes, parsedById, 'price-desc').map((r) => r.id)).toEqual([2, 1, 3])
  })

  it('sorts by lowest price first, missing price last', () => {
    expect(sortRecipes(recipes, parsedById, 'price-asc').map((r) => r.id)).toEqual([1, 2, 3])
  })
})
