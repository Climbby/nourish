/**
 * Bridges recipe ingredients to the per-100 g macros stored on products, so a
 * recipe's nutrition can be computed rather than typed in.
 */

import type { Product } from '../types/grocy'
import type { GenericoFavorites } from './genericoFavorites'
import {
  findIngredientProductMatches,
  pickProductForIngredient,
  type StockByProduct,
} from './ingredientMatch'
import { getMacrosFromDesc, type ProductMacros } from './productNutrition'

/**
 * Build a name → macros lookup over the product catalogue.
 *
 * Exact (accent- and case-insensitive) matches on product name, NomeCurto, and
 * Generico. Fuzzy matching is deliberately left out: a wrong product silently
 * produces plausible-looking but wrong numbers. An unmatched ingredient is
 * reported instead. In-stock SKU, then the only complete variant, then the
 * family favorite; if that pick has no macros, the first sibling that does.
 */
export function makeProductMacroLookup(
  products: Product[],
  favorites?: GenericoFavorites,
  stockByProduct?: StockByProduct
): (ingredientName: string) => ProductMacros | null {
  return (ingredientName: string) => {
    const matches = findIngredientProductMatches(ingredientName, products)
    if (matches.length === 0) return null
    const { product: preferred } = pickProductForIngredient(matches, {
      favorites,
      stockByProduct,
    })
    if (preferred) {
      const macros = getMacrosFromDesc(preferred.description)
      if (macros) return macros
    }
    for (const product of matches) {
      const macros = getMacrosFromDesc(product.description)
      if (macros) return macros
    }
    return null
  }
}

/** How many products still need their macros filled in. */
export function productsMissingMacros(products: Product[]): Product[] {
  return products.filter((p) => getMacrosFromDesc(p.description) === null)
}
