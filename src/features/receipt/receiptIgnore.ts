/**
 * Receipt lines the cook does not want in Despensa (bags, trash bags, …).
 * Exact accent/case-insensitive match — same normalize as talão names.
 */

import { getGenericoFromDesc } from '../../utils/despensaAnalytics'
import { profileScopedKey } from '../../utils/householdProfiles'
import { normalizeReceiptName } from './parsers/utils'

export const RECEIPT_IGNORE_KEY = 'nourish-receipt-ignore'

const memoryFallback = new Set<string>()

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

function storageKey(): string {
  return profileScopedKey(RECEIPT_IGNORE_KEY)
}

export function loadReceiptIgnoreList(): string[] {
  if (!hasLocalStorage()) return [...memoryFallback]
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((n): n is string => typeof n === 'string' && normalizeReceiptName(n) !== '')
  } catch {
    return []
  }
}

function saveReceiptIgnoreList(names: string[]): void {
  const unique = [...new Set(names.map(normalizeReceiptName).filter(Boolean))]
  if (!hasLocalStorage()) {
    memoryFallback.clear()
    for (const n of unique) memoryFallback.add(n)
    return
  }
  try {
    localStorage.setItem(storageKey(), JSON.stringify(unique))
  } catch {
    /* quota / private mode */
  }
}

export function isReceiptNameIgnored(
  name: string,
  list: string[] = loadReceiptIgnoreList()
): boolean {
  const key = normalizeReceiptName(name)
  if (!key) return false
  return list.some((n) => normalizeReceiptName(n) === key)
}

export function ignoreReceiptNames(names: string[]): string[] {
  const next = [...loadReceiptIgnoreList()]
  for (const name of names) {
    const key = normalizeReceiptName(name)
    if (!key) continue
    if (!next.some((n) => normalizeReceiptName(n) === key)) next.push(key)
  }
  saveReceiptIgnoreList(next)
  return next
}

export function unignoreReceiptNames(names: string[]): string[] {
  const drop = new Set(names.map(normalizeReceiptName).filter(Boolean))
  const next = loadReceiptIgnoreList().filter((n) => !drop.has(normalizeReceiptName(n)))
  saveReceiptIgnoreList(next)
  return next
}

/**
 * Names to blacklist when ignoring Despensa products.
 * Always the SKU (`product.name`); Generico when `includeGenerico` (family / singleton).
 */
export function receiptIgnoreNamesForProducts(
  products: Array<{ name: string; description?: string | null }>,
  opts?: { includeGenerico?: boolean }
): string[] {
  const includeGenerico = opts?.includeGenerico !== false
  const seen = new Set<string>()
  const names: string[] = []
  const add = (raw: string | null | undefined) => {
    const trimmed = raw?.trim() ?? ''
    const key = normalizeReceiptName(trimmed)
    if (!key || seen.has(key)) return
    seen.add(key)
    names.push(trimmed)
  }
  for (const product of products) {
    add(product.name)
    if (includeGenerico) add(getGenericoFromDesc(product.description ?? null))
  }
  return names
}

/** Unchecked review lines join the list; checked lines leave it. */
export function syncReceiptIgnoreFromReview(
  lines: { included: boolean; names: string[] }[]
): void {
  const add: string[] = []
  const remove: string[] = []
  for (const line of lines) {
    if (line.included) remove.push(...line.names)
    else add.push(...line.names)
  }
  if (add.length > 0) ignoreReceiptNames(add)
  if (remove.length > 0) unignoreReceiptNames(remove)
}
