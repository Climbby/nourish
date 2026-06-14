import { describe, expect, it } from 'vitest'
import { filterNewShoppingNeeds, findIngredientShoppingNeeds } from './plannedMealsShopping'
import type { Product, Recipe, ShoppingListItem, StockItem } from '../types/grocy'

const recipe = (id: number, name: string, ingredients: string): Recipe => ({
  id,
  name,
  description: `[Ingredientes]\n${ingredients}`,
  base_servings: 1,
  desired_servings: 1,
  not_check_shoppinglist: 0,
  picture_file_name: null,
  type: 'normal',
})

const product = (id: number, name: string): Product => ({
  id,
  name,
  description: null,
  product_group_id: 6,
  qu_id_stock: 2,
  qu_id_purchase: 2,
  picture_file_name: null,
  calories: null,
})

describe('findIngredientShoppingNeeds', () => {
  it('flags ingredients with zero stock', () => {
    const recipes = [recipe(1, 'Atum pasta', 'Atum enlatado|1.50')]
    const products = [product(10, 'Atum enlatado')]
    const stock: StockItem[] = [{ product_id: 10, amount: 0, value: 0, product: products[0] }]

    const needs = findIngredientShoppingNeeds(recipes, products, stock)
    expect(needs).toHaveLength(1)
    expect(needs[0].productId).toBe(10)
  })

  it('skips ingredients with stock available', () => {
    const recipes = [recipe(1, 'Atum pasta', 'Atum enlatado|1.50')]
    const products = [product(10, 'Atum enlatado')]
    const stock: StockItem[] = [{ product_id: 10, amount: 2, value: 3, product: products[0] }]

    expect(findIngredientShoppingNeeds(recipes, products, stock)).toHaveLength(0)
  })
})

describe('filterNewShoppingNeeds', () => {
  it('excludes products already on the shopping list', () => {
    const needs = [
      { productId: 10, productName: 'A', ingredientName: 'A', recipeName: 'R', buyAmount: 1 },
    ]
    const existing: ShoppingListItem[] = [{ id: 1, product_id: 10, amount: 1, note: null, done: 0 }]
    expect(filterNewShoppingNeeds(needs, existing)).toHaveLength(0)
  })
})
