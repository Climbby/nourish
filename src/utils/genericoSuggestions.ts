/**
 * Suggest / autocomplete Despensa [Generico] family labels from existing products.
 */

import {
  cookingName,
  getGenericoFromDesc,
  getNomeCurtoFromDesc,
} from './despensaAnalytics'

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function tokenSet(s: string): Set<string> {
  return new Set(
    normalizeKey(s)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1)
  )
}

/** Jaccard-ish similarity between receipt SKU and a family label. */
export function genericoSimilarity(receiptName: string, candidate: string): number {
  const ta = tokenSet(receiptName)
  const tb = tokenSet(candidate)
  if (ta.size === 0 || tb.size === 0) {
    const na = normalizeKey(receiptName)
    const nb = normalizeKey(candidate)
    if (!na || !nb) return 0
    if (na === nb) return 1
    if (na.includes(nb) || nb.includes(na)) return 0.7
    return 0
  }
  let overlap = 0
  for (const t of ta) {
    if (tb.has(t)) overlap++
  }
  const union = new Set([...ta, ...tb]).size
  const jaccard = overlap / union
  const na = normalizeKey(receiptName)
  const nb = normalizeKey(candidate)
  const contains = na.includes(nb) || nb.includes(na) ? 0.3 : 0
  return Math.min(1, jaccard + contains)
}

export type GenericoSourceProduct = {
  name: string
  description: string | null
}

/** Unique Generico + cooking-name labels from Despensa products. */
export function listKnownGenericos(products: GenericoSourceProduct[]): string[] {
  const byKey = new Map<string, string>()
  for (const p of products) {
    const labels = [
      getGenericoFromDesc(p.description),
      getNomeCurtoFromDesc(p.description),
      cookingName(p.name, p.description) !== p.name ? cookingName(p.name, p.description) : null,
    ]
    for (const label of labels) {
      const t = label?.trim()
      if (!t) continue
      const key = normalizeKey(t)
      if (!byKey.has(key)) byKey.set(key, t)
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'pt'))
}

const SUGGEST_THRESHOLD = 0.35

/** Best existing family label for a receipt SKU, if any. */
export function suggestGenericoForName(
  receiptName: string,
  known: string[]
): { label: string; score: number } | null {
  let best: { label: string; score: number } | null = null
  for (const label of known) {
    const score = genericoSimilarity(receiptName, label)
    if (!best || score > best.score) best = { label, score }
  }
  if (best && best.score >= SUGGEST_THRESHOLD) return best
  return null
}

/** Autocomplete filter; empty query returns top known labels. */
export function filterGenericoSuggestions(
  query: string,
  known: string[],
  limit = 8
): string[] {
  const q = query.trim()
  if (!q) return known.slice(0, limit)
  const nq = normalizeKey(q)
  const scored = known
    .map((label) => {
      const nl = normalizeKey(label)
      let score = 0
      if (nl === nq) score = 1
      else if (nl.startsWith(nq)) score = 0.9
      else if (nl.includes(nq)) score = 0.7
      else score = genericoSimilarity(q, label)
      return { label, score }
    })
    .filter((x) => x.score >= 0.25)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'pt'))
  return scored.slice(0, limit).map((x) => x.label)
}
