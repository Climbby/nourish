import type { Product, Recipe, ShoppingListItem, StockItem } from '../types/grocy'
import { findBestProductMatch } from '../features/receipt/matchProduct'
import { getBuyAmountFromDesc } from './despensaAnalytics'
import type { GenericoFavorites } from './genericoFavorites'
import {
  findIngredientProductMatches,
  resolveProductForIngredient,
  stockByProductId,
} from './ingredientMatch'
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
  stock: StockItem[],
  favorites?: GenericoFavorites
): IngredientShoppingNeed[] {
  const stockMap = stockByProductId(stock)
  const seen = new Set<number>()
  const needs: IngredientShoppingNeed[] = []

  for (const recipe of recipes) {
    const { ingredientItems } = parseDescription(recipe.description ?? '')
    for (const ing of ingredientItems) {
      const resolved = resolveProductForIngredient(ing.name, products, favorites, stockMap)
      const match = resolved
        ? { productId: resolved.id }
        : findBestProductMatch(ing.name, products)
      if (!match || seen.has(match.productId)) continue

      const familyInStock = findIngredientProductMatches(ing.name, products).some(
        (p) => (stockMap[p.id] ?? 0) > 0
      )
      if (familyInStock) continue

      const amount = stockMap[match.productId] ?? 0
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
    existingList.flatMap((i) =>
      !i.done && i.product_id != null && i.product_id > 0 ? [i.product_id] : []
    )
  )
  return needs.filter((n) => !onList.has(n.productId))
}
