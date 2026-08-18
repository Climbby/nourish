import type { StockLogEntry } from '../types/grocy'
import type { VerifiedField } from './verification'
import { parseVerifiedFields, upsertVerifiedSection } from './verification'
import { formatMacrosSection, getMacrosFromDesc } from './productNutrition'

export interface DespensaAnalytics {
  dailyAvg: number
  daysRemaining: number | null
  isLow: boolean
  avgDaysBetweenPurchases: number | null
}

export function getBuyAmountFromDesc(description: string | null, productId?: number): number {
  if (description) {
    const m = description.match(/\[BuyAmount\]\s*(\d+)/)
    if (m) return parseInt(m[1], 10)
  }
  const legacy: Record<number, number> = { 17: 6 }
  if (productId !== undefined && legacy[productId]) return legacy[productId]
  return 1
}

export function getPriceFromDesc(description: string | null): number | null {
  if (!description) return null
  const m = description.match(/\[Preco\]\s*([\d.]+)/)
  if (!m) return null
  const val = parseFloat(m[1])
  return isNaN(val) || val <= 0 ? null : val
}

/** Last purchase store from receipt commit, e.g. Continente Bom Dia… */
export function getStoreFromDesc(description: string | null): string | null {
  if (!description) return null
  const m = description.match(/\[Loja\]\s*\n?\s*([^\n[]+)/)
  const label = m?.[1]?.trim()
  return label || null
}

/** `kg` when price in description is per kilogram (weighed produce). */
export function getPriceUnitFromDesc(description: string | null): 'kg' | 'un' {
  if (!description) return 'un'
  const m = description.match(/\[PrecoUnit\]\s*\n?\s*(kg|un)/i)
  if (m?.[1]?.toLowerCase() === 'kg') return 'kg'
  return 'un'
}

export const DESPENSA_CAT_SUGGESTIONS = [
  'Cereais',
  'Leite',
  'Padaria',
  'Bebidas',
  'Frescos',
  'Limpeza',
  'Outros',
] as const

/** Manual pantry category from product description, e.g. Cereais. */
export function getDespensaCatFromDesc(description: string | null): string | null {
  if (!description) return null
  const m = description.match(/\[DespensaCat\]\s*\n?\s*([^\n[]+)/)
  const cat = m?.[1]?.trim()
  return cat || null
}

/** Cooking / search alias, e.g. "Atum" for a long receipt name. */
export function getNomeCurtoFromDesc(description: string | null): string | null {
  if (!description) return null
  const m = description.match(/\[NomeCurto\]\s*\n?\s*([^\n[]+)/)
  const name = m?.[1]?.trim()
  return name || null
}

/**
 * Shared Despensa family label for variants (e.g. "Cogumelos").
 * Distinct from NomeCurto (meals) — grouping only.
 */
export function getGenericoFromDesc(description: string | null): string | null {
  if (!description) return null
  const m = description.match(/\[Generico\]\s*\n?\s*([^\n[]+)/)
  const name = m?.[1]?.trim()
  return name || null
}

/** Grams per stock unit (1 lata, 1 ovo) — used to turn meal counts into grams. */
export function getUnitGramsFromDesc(description: string | null): number | null {
  if (!description) return null
  const m = description.match(/\[UnitGrams\]\s*\n?\s*([\d.]+)/)
  if (!m) return null
  const val = parseFloat(m[1])
  return isNaN(val) || val <= 0 ? null : val
}

const PACK_WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|kgs|gr(?:amas?)?|g)\b/gi

/**
 * Pack weight from a SKU / talão name (`185G`, `185GR`, `250 g`, `1KG`).
 * Skips `10x50G`-style multipliers where the number is ambiguous.
 */
export function inferUnitGramsFromName(name: string): number | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const re = new RegExp(PACK_WEIGHT_RE.source, 'gi')
  const matches = [...trimmed.matchAll(re)]
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]
    const idx = m.index ?? 0
    const before = trimmed.slice(Math.max(0, idx - 12), idx)
    if (/\d+\s*[x×]\s*$/i.test(before)) continue
    const n = parseFloat(m[1].replace(',', '.'))
    if (!(n > 0)) continue
    const unit = m[2].toLowerCase()
    const grams = unit === 'kg' || unit === 'kgs' ? n * 1000 : n
    if (grams < 5 || grams > 10000) continue
    return Math.round(grams * 100) / 100
  }
  return null
}

/** First pack weight found among SKU / talão names. */
export function inferUnitGramsFromNames(
  ...names: Array<string | null | undefined>
): number | null {
  for (const name of names) {
    if (!name) continue
    const grams = inferUnitGramsFromName(name)
    if (grams != null) return grams
  }
  return null
}

/** Display name for cooking: nome curto if set, else product name. */
export function cookingName(productName: string, description: string | null): string {
  return getNomeCurtoFromDesc(description) || productName
}

/**
 * Meal ingredient label: Generico family, then NomeCurto, then the product name.
 * SKU / receipt names stay on the Grocy product; meals should not show them.
 */
export function ingredientDisplayName(productName: string, description: string | null): string {
  return getGenericoFromDesc(description) || getNomeCurtoFromDesc(description) || productName
}

/** Despensa list title: Generico if set, else product name. */
export function despensaDisplayName(productName: string, description: string | null): string {
  return getGenericoFromDesc(description) || productName
}

function normalizeFamilyKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

/** Stable key for collapsing variants; singletons key by their own name. */
export function familyKey(productName: string, description: string | null): string {
  const g = getGenericoFromDesc(description)
  return normalizeFamilyKey(g || productName)
}

/** Short brand for Despensa cards: "Continente Bom Dia …" → "Continente". */
export function shortStoreBrand(label: string): string {
  const lower = label.toLowerCase()
  const brands: [RegExp, string][] = [
    [/continente/, 'Continente'],
    [/auchan|jumbo/, 'Auchan'],
    [/intermarch/, 'Intermarché'],
    [/pingo\s*doce/, 'Pingo Doce'],
    [/lidl/, 'Lidl'],
    [/minipre[cç]o|minipreco/, 'Minipreço'],
    [/aldi/, 'Aldi'],
  ]
  for (const [re, name] of brands) {
    if (re.test(lower)) return name
  }
  const first = label.split(/[\s,–—-]+/)[0]
  return first || label
}

export function buildDespensaDescription(
  buyAmount: number | string,
  price?: number | string | null,
  opts?: {
    verified?: Set<VerifiedField>
    existingDescription?: string | null
    storeLabel?: string | null
    priceUnit?: 'kg' | 'un' | null
    despensaCat?: string | null
    nomeCurto?: string | null
    generico?: string | null
    unitGrams?: number | string | null
  }
): string {
  const parts = [`[BuyAmount]\n${buyAmount}`]
  if (price != null && price !== '') {
    const val = typeof price === 'string' ? parseFloat(price) : price
    if (!isNaN(val) && val > 0) parts.push(`[Preco]\n${val.toFixed(2)}`)
  }
  const priceUnit =
    opts?.priceUnit === 'kg' || opts?.priceUnit === 'un'
      ? opts.priceUnit
      : getPriceUnitFromDesc(opts?.existingDescription ?? null)
  if (priceUnit === 'kg') parts.push(`[PrecoUnit]\nkg`)
  const store =
    (opts?.storeLabel && opts.storeLabel.trim()) ||
    getStoreFromDesc(opts?.existingDescription ?? null)
  if (store) parts.push(`[Loja]\n${store}`)
  const cat =
    opts?.despensaCat !== undefined
      ? opts.despensaCat?.trim() || null
      : getDespensaCatFromDesc(opts?.existingDescription ?? null)
  if (cat) parts.push(`[DespensaCat]\n${cat}`)
  const nomeCurto =
    opts?.nomeCurto !== undefined
      ? opts.nomeCurto?.trim() || null
      : getNomeCurtoFromDesc(opts?.existingDescription ?? null)
  if (nomeCurto) parts.push(`[NomeCurto]\n${nomeCurto}`)
  const generico =
    opts?.generico !== undefined
      ? opts.generico?.trim() || null
      : getGenericoFromDesc(opts?.existingDescription ?? null)
  if (generico) parts.push(`[Generico]\n${generico}`)
  const unitGramsRaw =
    opts?.unitGrams !== undefined
      ? opts.unitGrams
      : getUnitGramsFromDesc(opts?.existingDescription ?? null)
  if (unitGramsRaw != null && unitGramsRaw !== '') {
    const grams =
      typeof unitGramsRaw === 'string' ? parseFloat(unitGramsRaw) : unitGramsRaw
    if (!isNaN(grams) && grams > 0) parts.push(`[UnitGrams]\n${grams}`)
  }
  // Per-100 g macros are edited elsewhere — carry them through so saving a
  // product from the Despensa form never wipes them.
  const macros = getMacrosFromDesc(opts?.existingDescription ?? null)
  if (macros) parts.push(formatMacrosSection(macros))
  const core = parts.join('\n\n')
  const verified =
    opts?.verified ??
    (opts?.existingDescription ? parseVerifiedFields(opts.existingDescription) : new Set())
  return upsertVerifiedSection(core, verified)
}

/** Format catalog/stock price for Despensa; append /kg when stored as weight price. */
export function formatDespensaPriceLabel(
  price: number,
  description: string | null
): string {
  const euro = `€${price.toFixed(2)}`
  return getPriceUnitFromDesc(description) === 'kg' ? `${euro}/kg` : euro
}

/** Unit price from stock value, or catalog price in product description. */
export function getDespensaUnitPrice(
  amount: number,
  value: number,
  description: string | null
): number | null {
  if (amount > 0 && value > 0) return value / amount
  return getPriceFromDesc(description)
}

export function purchaseTotalPrice(unitPrice: number | null, amount: number): number | undefined {
  if (unitPrice == null || amount <= 0) return undefined
  return Math.round(unitPrice * amount * 100) / 100
}

export function computeDespensaAnalytics(
  log: StockLogEntry[],
  currentAmount: number,
  daysUntilNextShop?: number | null
): DespensaAnalytics | null {
  const active = log.filter((e) => !e.undone)
  const consumes = active.filter((e) => e.transaction_type === 'consume' && e.amount < 0)
  if (consumes.length < 2) return null

  const sorted = [...consumes].sort(
    (a, b) =>
      new Date(a.row_created_timestamp).getTime() - new Date(b.row_created_timestamp).getTime()
  )
  const totalConsumed = sorted.reduce((sum, e) => sum + Math.abs(e.amount), 0)
  const spanMs =
    new Date(sorted[sorted.length - 1].row_created_timestamp).getTime() -
    new Date(sorted[0].row_created_timestamp).getTime()
  const spanDays = spanMs / (1000 * 60 * 60 * 24)
  if (spanDays < 0.1) return null

  const dailyAvg = totalConsumed / spanDays
  const daysRemaining = dailyAvg > 0 ? currentAmount / dailyAvg : null

  const purchases = active
    .filter((e) => e.transaction_type === 'purchase' && e.amount > 0)
    .map((e) => new Date(e.row_created_timestamp).getTime())
    .sort((a, b) => a - b)

  let avgDaysBetweenPurchases: number | null = null
  if (purchases.length >= 2) {
    const gaps = purchases.slice(1).map((d, i) => (d - purchases[i]) / (1000 * 60 * 60 * 24))
    avgDaysBetweenPurchases = gaps.reduce((a, b) => a + b, 0) / gaps.length
  }

  const shopHorizon = daysUntilNextShop ?? avgDaysBetweenPurchases
  const isLow =
    daysRemaining !== null &&
    shopHorizon !== null &&
    shopHorizon > 0 &&
    daysRemaining < shopHorizon

  return { dailyAvg, daysRemaining, isLow, avgDaysBetweenPurchases }
}

/**
 * Higher = consumed more often. Uses daily average when the log has enough
 * history; otherwise total units consumed (still ranks habitual items above never-touched).
 */
export function consumptionScore(log: StockLogEntry[]): number {
  const consumes = log.filter((e) => !e.undone && e.transaction_type === 'consume' && e.amount < 0)
  if (consumes.length === 0) return 0

  const sorted = [...consumes].sort(
    (a, b) =>
      new Date(a.row_created_timestamp).getTime() - new Date(b.row_created_timestamp).getTime()
  )
  const totalConsumed = sorted.reduce((sum, e) => sum + Math.abs(e.amount), 0)
  if (consumes.length < 2) return totalConsumed

  const spanDays =
    (new Date(sorted[sorted.length - 1].row_created_timestamp).getTime() -
      new Date(sorted[0].row_created_timestamp).getTime()) /
    (1000 * 60 * 60 * 24)
  if (spanDays < 0.1) return totalConsumed
  return totalConsumed / spanDays
}

/** Most-consumed first within a Despensa section (Em stock or empty). */
export function sortByConsumption<T extends { product_id: number; product: { name: string } }>(
  list: T[],
  logsByProduct: Record<number, StockLogEntry[]>
): T[] {
  return [...list].sort((a, b) => {
    const diff =
      consumptionScore(logsByProduct[b.product_id] ?? []) -
      consumptionScore(logsByProduct[a.product_id] ?? [])
    if (diff !== 0) return diff
    return a.product.name.localeCompare(b.product.name, 'pt')
  })
}
