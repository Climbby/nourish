import { normalizeReceiptName } from './parsers/utils'

/** Levenshtein edit distance between two strings. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const prev = new Array<number>(b.length + 1)
  const curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }
  return prev[b.length]
}

/** True when normalized names are equal or within maxDist edits. */
export function fuzzyNameEqual(a: string, b: string, maxDist = 2): boolean {
  const na = normalizeReceiptName(a)
  const nb = normalizeReceiptName(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (Math.abs(na.length - nb.length) > maxDist) return false
  return editDistance(na, nb) <= maxDist
}
