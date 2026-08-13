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

export interface DespensaFamily {
  key: string
  /** Generico label, or the single product name when ungrouped. */
  title: string
  variants: StockItem[]
  totalAmount: number
  /** Representative row for photo / navigation (prefer in-stock with photo). */
  primary: StockItem
}

function pickPrimary(variants: StockItem[]): StockItem {
  const withStock = variants.filter((v) => v.amount > 0)
  const pool = withStock.length > 0 ? withStock : variants
  return (
    pool.find((v) => v.product.picture_file_name) ??
    pool[0]
  )
}

export function groupDespensaFamilies(items: StockItem[]): DespensaFamily[] {
  const map = new Map<string, StockItem[]>()
  for (const item of items) {
    const key = familyKey(item.product.name, item.product.description)
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }

  const families: DespensaFamily[] = []
  for (const [key, variants] of map) {
    const sorted = [...variants].sort((a, b) =>
      a.product.name.localeCompare(b.product.name, 'pt')
    )
    const primary = pickPrimary(sorted)
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

/** Sort families by aggregated consumption of all variants. */
export function sortFamiliesByConsumption(
  families: DespensaFamily[],
  logsByProduct: Record<number, StockLogEntry[]>
): DespensaFamily[] {
  return [...families].sort((a, b) => {
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
