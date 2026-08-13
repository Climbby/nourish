/**
 * Resolve meal ingredient € and grams from a Despensa product + count.
 */

import type { Product } from '../types/grocy'
import {
  cookingName,
  getBuyAmountFromDesc,
  getNomeCurtoFromDesc,
  getPriceFromDesc,
  getPriceUnitFromDesc,
  getUnitGramsFromDesc,
} from './despensaAnalytics'

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

/** Grams for `count` stock units, or null if the product has no UnitGrams. */
export function gramsForQuantity(
  description: string | null,
  count: number
): number | null {
  if (!(count > 0)) return null
  const unitGrams = getUnitGramsFromDesc(description)
  if (unitGrams == null) return null
  return Math.round(count * unitGrams * 100) / 100
}

/**
 * Cost for a meal quantity.
 * - `un`: count × (pack price / BuyAmount)
 * - `kg`: (grams / 1000) × price-per-kg; grams = count × UnitGrams when available
 */
export function costForQuantity(
  description: string | null,
  count: number,
  productId?: number
): number | null {
  if (!(count > 0)) return null
  const packPrice = getPriceFromDesc(description)
  if (packPrice == null) return null

  if (getPriceUnitFromDesc(description) === 'kg') {
    const grams = gramsForQuantity(description, count)
    if (grams == null) return null
    return Math.round((grams / 1000) * packPrice * 100) / 100
  }

  const buyAmount = getBuyAmountFromDesc(description, productId)
  if (!(buyAmount > 0)) return null
  return Math.round(count * (packPrice / buyAmount) * 100) / 100
}

export interface ResolvedIngredientFields {
  name: string
  price: string
  grams: string
  qty: string
  productId: number
  unitGrams: number | null
}

/** Fill ingredient row fields after picking a Despensa product and a count. */
export function resolveIngredientFromProduct(
  product: Product,
  count: number
): ResolvedIngredientFields {
  const unitGrams = getUnitGramsFromDesc(product.description)
  const grams = gramsForQuantity(product.description, count)
  const price = costForQuantity(product.description, count, product.id)
  return {
    name: cookingName(product.name, product.description),
    price: price != null ? price.toFixed(2) : '',
    grams: grams != null ? String(grams) : '',
    qty: String(count),
    productId: product.id,
    unitGrams,
  }
}

/** Local Despensa autocomplete: match full name or NomeCurto. */
export function filterProductsForIngredient(
  query: string,
  products: Product[],
  limit = 8
): Product[] {
  const q = normalize(query)
  if (q.length < 1) return []
  const scored: { product: Product; score: number }[] = []
  for (const product of products) {
    const full = normalize(product.name)
    const curto = getNomeCurtoFromDesc(product.description)
    const curtoN = curto ? normalize(curto) : ''
    if (!full.includes(q) && !(curtoN && curtoN.includes(q))) continue
    const exact = full === q || curtoN === q
    const prefix = full.startsWith(q) || (curtoN !== '' && curtoN.startsWith(q))
    scored.push({ product, score: exact ? 3 : prefix ? 2 : 1 })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, 'pt'))
    .slice(0, limit)
    .map((s) => s.product)
}

export interface HydratedIngredientLink {
  name: string
  productId?: number
  unitGrams: number | null
  qty: string
}

/**
 * Re-link a saved ingredient line to a Despensa product by cooking name / full name.
 * Infers qty from grams ÷ UnitGrams when possible.
 */
export function hydrateIngredientFromProducts(
  name: string,
  grams: number | null,
  products: Product[]
): HydratedIngredientLink {
  const key = normalize(name)
  const match =
    products.find((p) => normalize(cookingName(p.name, p.description)) === key) ??
    products.find((p) => normalize(p.name) === key) ??
    null
  if (!match) {
    return { name, unitGrams: null, qty: '' }
  }
  const unitGrams = getUnitGramsFromDesc(match.description)
  let qty = ''
  if (unitGrams != null && grams != null && grams > 0) {
    qty = String(Math.round((grams / unitGrams) * 100) / 100)
  } else if (unitGrams != null) {
    qty = '1'
  }
  return {
    name: cookingName(match.name, match.description),
    productId: match.id,
    unitGrams,
    qty,
  }
}
