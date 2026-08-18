/**
 * Resolve meal ingredient € and grams from a Despensa product + count.
 */

import type { Product } from '../types/grocy'
import type { IngredientRow } from './buildDescription'
import {
  familyKey,
  getBuyAmountFromDesc,
  getGenericoFromDesc,
  getNomeCurtoFromDesc,
  getPriceFromDesc,
  getPriceUnitFromDesc,
  getUnitGramsFromDesc,
  inferUnitGramsFromName,
  ingredientDisplayName,
} from './despensaAnalytics'
import type { GenericoFavorites } from './genericoFavorites'
import {
  normalizeIngredientName,
  resolveProductForIngredient,
  type StockByProduct,
} from './ingredientMatch'

export { inferUnitGramsFromName } from './despensaAnalytics'

/** Stored grams that are almost certainly a unit count (e.g. 1 pack saved as 1 g). */
export function looksLikeStoredUnitCount(grams: number, unitGrams: number): boolean {
  if (!(unitGrams > 0) || !(grams > 0)) return false
  if (grams !== Math.round(grams) || grams > 6) return false
  return grams < unitGrams / 8
}

/**
 * Pack grams for unit counts: `[UnitGrams]`, then a sibling in the same
 * Generico family, then the SKU name (`185G`).
 */
export function resolveUnitGrams(product: Product, catalog: Product[] = []): number | null {
  const own =
    getUnitGramsFromDesc(product.description) ?? inferUnitGramsFromName(product.name)
  if (own != null) return own

  const key = familyKey(product.name, product.description)
  for (const sibling of catalog) {
    if (sibling.id === product.id) continue
    if ((sibling.active ?? 1) === 0) continue
    if (familyKey(sibling.name, sibling.description) !== key) continue
    const grams =
      getUnitGramsFromDesc(sibling.description) ?? inferUnitGramsFromName(sibling.name)
    if (grams != null) return grams
  }
  return null
}

/** Grams for `count` stock units, or null if the product has no UnitGrams. */
export function gramsForQuantity(
  description: string | null,
  count: number,
  unitGramsOverride?: number | null
): number | null {
  if (!(count > 0)) return null
  const unitGrams = unitGramsOverride ?? getUnitGramsFromDesc(description)
  if (unitGrams == null) return null
  return gramsFromUnitCount(count, unitGrams)
}

/** Count ↔ grams when UnitGrams is known. Rounded to 2 decimals. */
export function gramsFromUnitCount(count: number, unitGrams: number): number {
  return Math.round(count * unitGrams * 100) / 100
}

export function qtyFromGrams(grams: number, unitGrams: number): number {
  if (!(unitGrams > 0)) return 0
  return Math.round((grams / unitGrams) * 100) / 100
}

export function canUseUnitCount(unitGrams: number | null | undefined): boolean {
  return unitGrams != null && unitGrams > 0
}

/**
 * Cost for a meal quantity.
 * - `un`: count × (pack price / BuyAmount)
 * - `kg`: (grams / 1000) × price-per-kg; grams = count × UnitGrams when available
 */
export function costForQuantity(
  description: string | null,
  count: number,
  productId?: number,
  unitGramsOverride?: number | null
): number | null {
  if (!(count > 0)) return null
  const packPrice = getPriceFromDesc(description)
  if (packPrice == null) return null

  if (getPriceUnitFromDesc(description) === 'kg') {
    const grams = gramsForQuantity(description, count, unitGramsOverride)
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
  count: number,
  catalog: Product[] = []
): ResolvedIngredientFields {
  const unitGrams = resolveUnitGrams(product, catalog)
  const grams = gramsForQuantity(product.description, count, unitGrams)
  const price = costForQuantity(product.description, count, product.id, unitGrams)
  return {
    name: ingredientDisplayName(product.name, product.description),
    price: price != null ? price.toFixed(2) : '',
    grams: grams != null ? String(grams) : '',
    qty: String(count),
    productId: product.id,
    unitGrams,
  }
}

/** Local Despensa autocomplete: match SKU, NomeCurto, or Generico. */
export function filterProductsForIngredient(
  query: string,
  products: Product[],
  limit = 8,
  favorites?: GenericoFavorites
): Product[] {
  const q = normalizeIngredientName(query)
  if (q.length < 1) return []
  const scored: { product: Product; score: number; favorite: boolean }[] = []
  for (const product of products) {
    const full = normalizeIngredientName(product.name)
    const curto = getNomeCurtoFromDesc(product.description)
    const curtoN = curto ? normalizeIngredientName(curto) : ''
    const generico = getGenericoFromDesc(product.description)
    const genN = generico ? normalizeIngredientName(generico) : ''
    if (!full.includes(q) && !(curtoN && curtoN.includes(q)) && !(genN && genN.includes(q))) continue
    const exact = full === q || curtoN === q || genN === q
    const prefix =
      full.startsWith(q) ||
      (curtoN !== '' && curtoN.startsWith(q)) ||
      (genN !== '' && genN.startsWith(q))
    const favKey = familyKey(product.name, product.description)
    scored.push({
      product,
      score: exact ? 3 : prefix ? 2 : 1,
      favorite: favorites?.[favKey] === product.id,
    })
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.favorite) - Number(a.favorite) ||
        a.product.name.localeCompare(b.product.name, 'pt')
    )
    .slice(0, limit)
    .map((s) => s.product)
}

export interface HydratedIngredientLink {
  name: string
  productId?: number
  unitGrams: number | null
  qty: string
  /** Grams after unit-count repair (1 pack saved as 1 g → pack weight). */
  grams?: number | null
}

/**
 * Re-link a saved ingredient line to a Despensa product by SKU / NomeCurto / Generico.
 * Infers qty from grams ÷ UnitGrams when possible. Prefers stock, then the only
 * complete variant, then the family favorite.
 */
export function hydrateIngredientFromProducts(
  name: string,
  grams: number | null,
  products: Product[],
  favorites?: GenericoFavorites,
  stockByProduct?: StockByProduct
): HydratedIngredientLink {
  const match = resolveProductForIngredient(name, products, favorites, stockByProduct)
  if (!match) {
    return { name, unitGrams: null, qty: '', grams }
  }
  const unitGrams = resolveUnitGrams(match, products)
  let qty = ''
  let gramsOut = grams
  if (unitGrams != null && grams != null && grams > 0) {
    if (looksLikeStoredUnitCount(grams, unitGrams)) {
      qty = String(grams)
      gramsOut = gramsFromUnitCount(grams, unitGrams)
    } else {
      qty = String(qtyFromGrams(grams, unitGrams))
    }
  } else if (unitGrams != null) {
    qty = '1'
  }
  return {
    name: ingredientDisplayName(match.name, match.description),
    productId: match.id,
    unitGrams,
    qty,
    grams: gramsOut,
  }
}

/**
 * Link a typed ingredient name to a Despensa product on exact SKU / NomeCurto /
 * Generico match. Keeps already-entered qty, grams, and €. `commitName` swaps
 * the typed string for the family display name (on blur / pick).
 */
export function applyIngredientName(
  row: IngredientRow,
  name: string,
  products: Product[],
  favorites?: GenericoFavorites,
  opts?: { commitName?: boolean; stockByProduct?: StockByProduct }
): IngredientRow {
  const match = resolveProductForIngredient(name, products, favorites, opts?.stockByProduct)
  if (!match) {
    return {
      ...row,
      name,
      productId: undefined,
      unitGrams: undefined,
    }
  }

  const unitGrams = resolveUnitGrams(match, products)
  const existingQty = parseFloat(row.qty ?? '')
  const existingGrams = parseFloat(row.grams ?? '')
  const hasQty = existingQty > 0
  const hasGrams = existingGrams > 0
  const hasPrice = parseFloat(row.price) > 0
  const gramsWereACount =
    hasGrams && canUseUnitCount(unitGrams) && unitGrams != null
      ? looksLikeStoredUnitCount(existingGrams, unitGrams)
      : false

  let count = 1
  if (hasQty) count = existingQty
  else if (gramsWereACount) count = existingGrams
  else if (hasGrams && canUseUnitCount(unitGrams) && unitGrams) {
    count = qtyFromGrams(existingGrams, unitGrams)
  }

  const resolved = resolveIngredientFromProduct(match, count, products)
  return {
    ...row,
    name: opts?.commitName ? resolved.name : name,
    productId: resolved.productId,
    unitGrams: resolved.unitGrams,
    qty: hasQty ? row.qty : resolved.qty,
    grams: hasGrams && !gramsWereACount ? row.grams : resolved.grams,
    price: hasPrice ? row.price : resolved.price,
  }
}

export function patchIngredientAmountMode(
  row: IngredientRow,
  mode: NonNullable<IngredientRow['amountMode']>
): IngredientRow {
  if (mode === 'un' && canUseUnitCount(row.unitGrams) && row.unitGrams) {
    const grams = parseFloat(row.grams ?? '')
    const existingQty = parseFloat(row.qty ?? '')
    if (existingQty > 0) return { ...row, amountMode: mode }
    if (grams > 0 && looksLikeStoredUnitCount(grams, row.unitGrams)) {
      return {
        ...row,
        amountMode: mode,
        qty: String(grams),
        grams: String(gramsFromUnitCount(grams, row.unitGrams)),
      }
    }
    const qty = grams > 0 ? String(qtyFromGrams(grams, row.unitGrams)) : row.qty
    return { ...row, amountMode: mode, qty }
  }
  return { ...row, amountMode: mode }
}

/** Keep grams, qty, and € in sync when the user edits either amount field. */
export function patchIngredientAmount(
  row: IngredientRow,
  field: 'grams' | 'qty',
  value: string,
  products: Product[]
): IngredientRow {
  if (field === 'qty') {
    const count = parseFloat(value)
    if (row.productId != null && count > 0) {
      const product = products.find((p) => p.id === row.productId)
      if (product) {
        const resolved = resolveIngredientFromProduct(product, count, products)
        return {
          ...row,
          qty: value,
          price: resolved.price || row.price,
          grams: canUseUnitCount(resolved.unitGrams) ? resolved.grams : row.grams,
          name: resolved.name,
          unitGrams: resolved.unitGrams,
        }
      }
    }
    return { ...row, qty: value }
  }

  const grams = parseFloat(value)
  if (row.productId != null && grams > 0 && canUseUnitCount(row.unitGrams) && row.unitGrams) {
    const product = products.find((p) => p.id === row.productId)
    if (product) {
      const count = qtyFromGrams(grams, row.unitGrams)
      const resolved = resolveIngredientFromProduct(product, count, products)
      return {
        ...row,
        grams: value,
        qty: String(count),
        price: resolved.price,
        name: resolved.name,
        unitGrams: resolved.unitGrams,
      }
    }
  }
  return { ...row, grams: value }
}
