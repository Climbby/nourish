import type { Product } from '../../types/grocy'
import { editDistance, fuzzyNameEqual } from './editDistance'
import { getAliasProductId } from './receiptAliases'
import { normalizeReceiptName } from './parsers/utils'

const MATCH_THRESHOLD = 0.45

function tokenSet(s: string): Set<string> {
  return new Set(normalizeReceiptName(s).split(' ').filter((t) => t.length > 1))
}

function similarity(a: string, b: string): number {
  const ta = tokenSet(a)
  const tb = tokenSet(b)
  if (ta.size === 0 || tb.size === 0) {
    // Fall back to short edit distance on whole normalized names (e.g. cerais↔cereais)
    if (fuzzyNameEqual(a, b, 2)) return 0.85
    return 0
  }

  let overlap = 0
  for (const t of ta) {
    if (tb.has(t)) overlap++
  }
  // Soft token overlap: tokens within edit distance 1 count as half a match
  for (const t of ta) {
    if (tb.has(t)) continue
    for (const u of tb) {
      if (Math.abs(t.length - u.length) <= 1 && editDistance(t, u) <= 1) {
        overlap += 0.5
        break
      }
    }
  }

  const union = new Set([...ta, ...tb]).size
  const jaccard = overlap / union

  const na = normalizeReceiptName(a)
  const nb = normalizeReceiptName(b)
  const contains = na.includes(nb) || nb.includes(na) ? 0.25 : 0
  const editBoost = fuzzyNameEqual(a, b, 2) ? 0.35 : 0

  return Math.min(1, jaccard + contains + editBoost)
}

export interface ProductMatch {
  productId: number
  score: number
}

export function findBestProductMatch(
  receiptName: string,
  products: Product[],
  aliasProductId?: number | null
): ProductMatch | null {
  const alias = aliasProductId ?? getAliasProductId(receiptName)
  if (alias != null) {
    const p = products.find((x) => x.id === alias)
    if (p) return { productId: p.id, score: 1 }
  }

  let best: ProductMatch | null = null
  for (const p of products) {
    const score = similarity(receiptName, p.name)
    if (!best || score > best.score) {
      best = { productId: p.id, score }
    }
  }

  if (best && best.score >= MATCH_THRESHOLD) return best
  return null
}

export function rankProductMatches(receiptName: string, products: Product[]): ProductMatch[] {
  return products
    .map((p) => ({ productId: p.id, score: similarity(receiptName, p.name) }))
    .filter((m) => m.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
}
