/**
 * Generico family helpers for ProductDetail: sibling SKUs + shared purchase history.
 * Grocy products stay separate; unification is UI-only.
 */

import type { Product, StockLogEntry } from '../types/grocy'
import { familyKey, getGenericoFromDesc, getPriceFromDesc } from './despensaAnalytics'
import type { StorePriceItem } from './storePrices'

export interface FamilyVariantSummary {
  id: number
  name: string
  picture_file_name: string | null
  price: number | null
  description: string | null
}

function hasPhoto(p: { picture_file_name: string | null }): boolean {
  return Boolean(p.picture_file_name)
}

/** Photo first, then Portuguese name — same order as Despensa family variants. */
export function sortFamilyVariants<T extends { name: string; picture_file_name: string | null }>(
  products: T[]
): T[] {
  return [...products].sort((a, b) => {
    const photoA = hasPhoto(a) ? 0 : 1
    const photoB = hasPhoto(b) ? 0 : 1
    if (photoA !== photoB) return photoA - photoB
    return a.name.localeCompare(b.name, 'pt')
  })
}

/**
 * Products sharing the same [Generico] (case/accent-insensitive).
 * No Generico, or a unique Generico → single-product list (no swipe UI).
 */
export function findGenericoSiblings(all: Product[], product: Product): Product[] {
  const generico = getGenericoFromDesc(product.description)
  if (!generico) return [product]

  const key = familyKey(product.name, product.description)
  const siblings = all.filter((p) => {
    if ((p.active ?? 1) !== 1) return false
    const g = getGenericoFromDesc(p.description)
    if (!g) return false
    return familyKey(p.name, p.description) === key
  })

  if (siblings.length === 0) return [product]
  return sortFamilyVariants(siblings)
}

export function toVariantSummaries(products: Product[]): FamilyVariantSummary[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    picture_file_name: p.picture_file_name,
    price: getPriceFromDesc(p.description),
    description: p.description,
  }))
}

/** After deleting `removedId`, stay on the next (or previous) sibling SKU. */
export function nextSiblingId(siblings: { id: number }[], removedId: number): number | null {
  const remaining = siblings.filter((s) => s.id !== removedId)
  if (remaining.length === 0) return null
  const idx = siblings.findIndex((s) => s.id === removedId)
  if (idx < 0) return remaining[0].id
  const after = siblings.slice(idx + 1).find((s) => s.id !== removedId)
  if (after) return after.id
  const before = siblings
    .slice(0, idx)
    .reverse()
    .find((s) => s.id !== removedId)
  return before?.id ?? remaining[0].id
}

/** Newest-first purchase rows across one or more SKUs. */
export function aggregateFamilyPurchases(
  logs: StockLogEntry[],
  limit = 20
): StockLogEntry[] {
  return [...logs]
    .filter((e) => !e.undone && e.transaction_type === 'purchase')
    .sort(
      (a, b) =>
        new Date(b.row_created_timestamp.replace(' ', 'T')).getTime() -
        new Date(a.row_created_timestamp.replace(' ', 'T')).getTime()
    )
    .slice(0, limit)
}

/** Dedupe store-price observations by id (family-wide catalog history). */
export function mergeStorePriceItems(lists: StorePriceItem[][]): StorePriceItem[] {
  const byId = new Map<string, StorePriceItem>()
  for (const list of lists) {
    for (const item of list) {
      byId.set(item.id, item)
    }
  }
  return [...byId.values()].sort((a, b) => b.observed_at.localeCompare(a.observed_at))
}
