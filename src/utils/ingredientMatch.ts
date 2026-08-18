/**
 * Match a stored meal-ingredient name to a Despensa product.
 *
 * Exact (accent- and case-insensitive) on product name, then NomeCurto, then
 * Generico. Among siblings: starred favorite, else the only in-stock SKU,
 * else the only complete variant. When several still conflict, ask which
 * one to star.
 */

import type { Product } from '../types/grocy'
import {
  cookingName,
  familyKey,
  getGenericoFromDesc,
  getUnitGramsFromDesc,
  inferUnitGramsFromName,
  ingredientDisplayName,
} from './despensaAnalytics'
import type { GenericoFavorites } from './genericoFavorites'
import { getMacrosFromDesc } from './productNutrition'

export function normalizeIngredientName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Products that exactly match `name`, preferring SKU, then cooking name, then
 * family label. Rank groups are not mixed — a SKU hit is never replaced by a
 * Generico sibling.
 */
export function findIngredientProductMatches(name: string, products: Product[]): Product[] {
  const key = normalizeIngredientName(name)
  if (!key) return []

  const byName: Product[] = []
  const byCurto: Product[] = []
  const byGenerico: Product[] = []

  for (const product of products) {
    if (normalizeIngredientName(product.name) === key) {
      byName.push(product)
      continue
    }
    const curto = cookingName(product.name, product.description)
    const curtoN = curto ? normalizeIngredientName(curto) : ''
    const generico = getGenericoFromDesc(product.description)
    const genN = generico ? normalizeIngredientName(generico) : ''
    const curtoHit = curtoN !== '' && curtoN === key
    const genHit = genN !== '' && genN === key
    // NomeCurto that duplicates Generico is a family match, not a single SKU.
    if (curtoHit && !genHit) byCurto.push(product)
    if (genHit) byGenerico.push(product)
  }

  if (byName.length > 0) return byName
  if (byCurto.length > 0) return byCurto
  return byGenerico
}

export function pickFavoriteProduct(
  matches: Product[],
  favorites?: GenericoFavorites
): Product | null {
  if (matches.length === 0) return null
  return favoriteInMatches(matches, favorites) ?? matches[0]
}

/** Favorite SKU among matches, or null if none is starred. */
export function favoriteInMatches(
  matches: Product[],
  favorites?: GenericoFavorites
): Product | null {
  if (!favorites || matches.length === 0) return null
  for (const product of matches) {
    const key = familyKey(product.name, product.description)
    if (favorites[key] === product.id) return product
  }
  return null
}

export type StockByProduct = Record<number, number>

export function stockByProductId(
  rows: { product_id: number; amount: number }[]
): StockByProduct {
  const out: StockByProduct = {}
  for (const row of rows) {
    if (row.amount > 0) out[row.product_id] = row.amount
  }
  return out
}

/** Nutrition + pack weight (stored or inferred from the SKU name). */
export function isVariantComplete(product: Product): boolean {
  if (!getMacrosFromDesc(product.description)) return false
  const grams =
    getUnitGramsFromDesc(product.description) ?? inferUnitGramsFromName(product.name)
  return grams != null && grams > 0
}

export interface VariantPick {
  product: Product | null
  /** Conflicting variants — show a choice so the cook can star one. Empty = don't ask. */
  needsChoice: Product[]
}

function stockOf(id: number, stock?: StockByProduct): number {
  return stock?.[id] ?? 0
}

/**
 * Least-work pick among family variants:
 * starred favorite → only in-stock SKU → only complete SKU.
 * If several still conflict, ask and let the cook star one.
 */
export function pickProductForIngredient(
  matches: Product[],
  opts?: { favorites?: GenericoFavorites; stockByProduct?: StockByProduct }
): VariantPick {
  if (matches.length === 0) return { product: null, needsChoice: [] }
  if (matches.length === 1) return { product: matches[0], needsChoice: [] }

  const fav = favoriteInMatches(matches, opts?.favorites)
  if (fav) return { product: fav, needsChoice: [] }

  const inStock = matches.filter((p) => stockOf(p.id, opts?.stockByProduct) > 0)
  if (inStock.length === 1) return { product: inStock[0], needsChoice: [] }

  const complete = matches.filter(isVariantComplete)
  if (complete.length === 1) return { product: complete[0], needsChoice: [] }

  const pool =
    complete.length > 1 ? complete : inStock.length > 1 ? inStock : matches
  if (pool.length > 1) {
    return { product: pool[0], needsChoice: pool }
  }

  return { product: matches[0], needsChoice: [] }
}

export function resolveProductForIngredient(
  name: string,
  products: Product[],
  favorites?: GenericoFavorites,
  stockByProduct?: StockByProduct
): Product | null {
  return pickProductForIngredient(findIngredientProductMatches(name, products), {
    favorites,
    stockByProduct,
  }).product
}

/** Complete family SKUs the cook should pick between, or []. */
export function variantChoicesForIngredient(
  name: string,
  products: Product[],
  stockByProduct?: StockByProduct,
  favorites?: GenericoFavorites
): Product[] {
  return pickProductForIngredient(findIngredientProductMatches(name, products), {
    favorites,
    stockByProduct,
  }).needsChoice
}

export function variantChoiceLabel(product: Product): string {
  const generico = getGenericoFromDesc(product.description)
  const raw = product.name.replace(/\s+/g, ' ').trim()
  if (!generico) return raw
  const escaped = generico.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const stripped = raw
    .replace(new RegExp(escaped, 'ig'), '')
    .replace(/\s+/g, ' ')
    .replace(/^[.\-–—\s]+/, '')
    .trim()
  return stripped || raw
}

/** Generico (then NomeCurto, then product name) for a stored ingredient line. */
export function displayNameForIngredient(
  storedName: string,
  products: Product[],
  favorites?: GenericoFavorites
): string {
  const product = resolveProductForIngredient(storedName, products, favorites)
  if (!product) return storedName
  return ingredientDisplayName(product.name, product.description)
}
