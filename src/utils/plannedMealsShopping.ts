import type { Product, Recipe, ShoppingListItem, StockItem } from '../types/grocy'
import { findBestProductMatch } from '../features/receipt/matchProduct'
import { getBuyAmountFromDesc } from './despensaAnalytics'
import { parseDescription } from './parseDescription'

export interface IngredientShoppingNeed {
  productId: number
  productName: string
  ingredientName: string
  recipeName: string
  buyAmount: number
}

export function findIngredientShoppingNeeds(
  recipes: Recipe[],
  products: Product[],
  stock: StockItem[]
): IngredientShoppingNeed[] {
  const stockByProduct = new Map(stock.map((s) => [s.product_id, s.amount]))
  const seen = new Set<number>()
  const needs: IngredientShoppingNeed[] = []

  for (const recipe of recipes) {
    const { ingredientItems } = parseDescription(recipe.description ?? '')
    for (const ing of ingredientItems) {
      const match = findBestProductMatch(ing.name, products)
      if (!match || seen.has(match.productId)) continue

      const amount = stockByProduct.get(match.productId) ?? 0
      if (amount > 0) continue

      const product = products.find((p) => p.id === match.productId)
      if (!product) continue

      seen.add(match.productId)
      needs.push({
        productId: match.productId,
        productName: product.name,
        ingredientName: ing.name,
        recipeName: recipe.name,
        buyAmount: getBuyAmountFromDesc(product.description, product.id),
      })
    }
  }

  return needs
}

export function filterNewShoppingNeeds(
  needs: IngredientShoppingNeed[],
  existingList: ShoppingListItem[]
): IngredientShoppingNeed[] {
  const onList = new Set(
    existingList.filter((i) => !i.done).map((i) => i.product_id)
  )
  return needs.filter((n) => !onList.has(n.productId))
}
