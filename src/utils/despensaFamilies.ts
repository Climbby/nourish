/**
 * Collapse Despensa stock rows by [Generico] family.
 */

import type { StockItem, StockLogEntry } from '../types/grocy'
import {
  consumptionScore,
  despensaDisplayName,
  familyKey,
  getGenericoFromDesc,
} from './despensaAnalytics'
import type { GenericoFavorites } from './genericoFavorites'

export interface DespensaFamily {
  key: string
  /** Generico label, or the single product name when ungrouped. */
  title: string
  variants: StockItem[]
  totalAmount: number
  /** Representative row for photo / navigation (prefer in-stock with photo). */
  primary: StockItem
}

function hasProductPhoto(item: StockItem): boolean {
  return Boolean(item.product.picture_file_name)
}

function pickPrimary(variants: StockItem[], favoriteId?: number): StockItem {
  if (favoriteId != null) {
    const fav = variants.find((v) => v.product_id === favoriteId)
    if (fav) return fav
  }
  const withStock = variants.filter((v) => v.amount > 0)
  const pool = withStock.length > 0 ? withStock : variants
  return pool.find(hasProductPhoto) ?? pool[0]
}

/** Photo first, then Portuguese name — used inside a Generico family. */
function compareVariantsByPhotoThenName(a: StockItem, b: StockItem): number {
  const photoA = hasProductPhoto(a) ? 0 : 1
  const photoB = hasProductPhoto(b) ? 0 : 1
  if (photoA !== photoB) return photoA - photoB
  return a.product.name.localeCompare(b.product.name, 'pt')
}

export function groupDespensaFamilies(
  items: StockItem[],
  favorites: GenericoFavorites = {}
): DespensaFamily[] {
  const map = new Map<string, StockItem[]>()
  for (const item of items) {
    const key = familyKey(item.product.name, item.product.description)
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }

  const families: DespensaFamily[] = []
  for (const [key, variants] of map) {
    const sorted = [...variants].sort(compareVariantsByPhotoThenName)
    const primary = pickPrimary(sorted, favorites[key])
    const generico = getGenericoFromDesc(primary.product.description)
    families.push({
      key,
      title: generico || despensaDisplayName(primary.product.name, primary.product.description),
      variants: sorted,
      totalAmount: sorted.reduce((sum, v) => sum + v.amount, 0),
      primary,
    })
  }

  return families
}

/**
 * Sort families within a Despensa section (Em stock / empty).
 * Photo first (collapsed row uses a representative photo), then consumption, then title.
 */
export function sortFamiliesByConsumption(
  families: DespensaFamily[],
  logsByProduct: Record<number, StockLogEntry[]>
): DespensaFamily[] {
  return [...families].sort((a, b) => {
    const photoA = familyHasPhoto(a) ? 0 : 1
    const photoB = familyHasPhoto(b) ? 0 : 1
    if (photoA !== photoB) return photoA - photoB
    const scoreA = a.variants.reduce(
      (s, v) => s + consumptionScore(logsByProduct[v.product_id] ?? []),
      0
    )
    const scoreB = b.variants.reduce(
      (s, v) => s + consumptionScore(logsByProduct[v.product_id] ?? []),
      0
    )
    if (scoreB !== scoreA) return scoreB - scoreA
    return a.title.localeCompare(b.title, 'pt')
  })
}

export function familyMatchesQuery(family: DespensaFamily, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (family.title.toLowerCase().includes(q)) return true
  return family.variants.some((v) => {
    const name = v.product.name.toLowerCase()
    const gen = (getGenericoFromDesc(v.product.description) ?? '').toLowerCase()
    return name.includes(q) || gen.includes(q)
  })
}

/** True when at least one variant has a product photo. */
export function familyHasPhoto(family: DespensaFamily): boolean {
  return family.variants.some(hasProductPhoto)
}

/**
 * Drop families with no photos. Multi-variant families keep only variants that
 * have a photo (family stays if ≥1 variant has one).
 */
export function filterFamiliesWithPhotos(
  families: DespensaFamily[],
  favorites: GenericoFavorites = {}
): DespensaFamily[] {
  return families
    .filter(familyHasPhoto)
    .map((family) => {
      if (family.variants.length <= 1) return family
      const withPhoto = family.variants.filter((v) => Boolean(v.product.picture_file_name))
      if (withPhoto.length === family.variants.length) return family
      return {
        ...family,
        variants: withPhoto,
        totalAmount: withPhoto.reduce((sum, v) => sum + v.amount, 0),
        primary: pickPrimary(withPhoto, favorites[family.key]),
      }
    })
}
