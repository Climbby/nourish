/**
 * Bridges recipe ingredients to the per-100 g macros stored on products, so a
 * recipe's nutrition can be computed rather than typed in.
 */

import type { Product } from '../types/grocy'
import { getNomeCurtoFromDesc } from './despensaAnalytics'
import { getMacrosFromDesc, type ProductMacros } from './productNutrition'

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Build a name → macros lookup over the product catalogue.
 *
 * Exact (accent- and case-insensitive) matches on product name and optional
 * NomeCurto. Fuzzy matching is deliberately left out: a wrong product silently
 * produces plausible-looking but wrong numbers. An unmatched ingredient is
 * reported instead. First product with macros wins on key collisions.
 */
export function makeProductMacroLookup(
  products: Product[]
): (ingredientName: string) => ProductMacros | null {
  const byName = new Map<string, ProductMacros>()

  for (const product of products) {
    const macros = getMacrosFromDesc(product.description)
    if (!macros) continue
    const keys = [normalize(product.name)]
    const curto = getNomeCurtoFromDesc(product.description)
    if (curto) keys.push(normalize(curto))
    for (const key of keys) {
      if (!byName.has(key)) byName.set(key, macros)
    }
  }

  return (ingredientName: string) => byName.get(normalize(ingredientName)) ?? null
}

/** How many products still need their macros filled in. */
export function productsMissingMacros(products: Product[]): Product[] {
  return products.filter((p) => getMacrosFromDesc(p.description) === null)
}
