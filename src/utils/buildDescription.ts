import type { VerifiedField } from './verification'
import { formatVerifiedSection } from './verification'
import type { MealOrigin } from './mealOrigin'
import { INGREDIENT_PRICE_IGNORE_FLAG } from './parseDescription'

export interface IngredientRow {
  id: number
  name: string
  price: string
  /** Quantity in grams (or ml). Optional — blank rows still round-trip. */
  grams?: string
  /** Count of Despensa stock units (form-only; grams are what get saved). */
  qty?: string
  /** Linked Despensa product (form-only; resolved into name|€|g on save). */
  productId?: number
  /** Cached UnitGrams from the linked product. */
  unitGrams?: number | null
  /** Form-only: enter grams or stock-unit count. Storage always persists grams. */
  amountMode?: 'g' | 'un'
  /** Skip € and quantity — still on the recipe, not in the meal total or macros. */
  ignorePrice?: boolean
}

export interface AutoTotalResult {
  /** Sum of non-ignored lines that have a price > 0. */
  total: number
  /** True when every named ingredient is priced (> 0) or ignored. */
  complete: boolean
  /** Named, non-ignored ingredients with no usable price. */
  missing: string[]
}

function hasUsablePrice(price: string): boolean {
  const p = parseFloat(price)
  return !isNaN(p) && p > 0
}

/**
 * Sum priced, non-ignored ingredient lines. Complete only when every named
 * row is either priced or ignored — empty name rows do not count.
 */
export function computeAutoTotal(rows: IngredientRow[]): AutoTotalResult {
  let total = 0
  const missing: string[] = []
  for (const r of rows) {
    const name = r.name.trim()
    if (!name) continue
    if (r.ignorePrice) continue
    if (hasUsablePrice(r.price)) {
      total += parseFloat(r.price)
    } else {
      missing.push(name)
    }
  }
  return { total, complete: missing.length === 0, missing }
}

/** Auto meal price to persist/display, or 0 when the sum is not yet complete. */
export function readyAutoTotal(rows: IngredientRow[]): number {
  const result = computeAutoTotal(rows)
  return result.complete ? result.total : 0
}

export interface BuildDescriptionInput {
  ingredientRows: IngredientRow[]
  steps: string
  nutrition: { calories: string; protein: string; carbs: string; fat: string }
  priceOverride: string
  /** Auto ingredient sum. Unused when `priceOverride` is set; otherwise derived from rows via `computeAutoTotal` (complete sums only). */
  autoTotal: number
  category?: string
  portions?: number | null
  verified?: Set<VerifiedField>
  origin?: MealOrigin | null
  /** Restaurant name for eat-out meals — stored in `[Local]`. */
  location?: string | null
  /** Optional GPS for distance on meal detail and Fora sort. */
  locationCoords?: { latitude: number; longitude: number } | null
  /** Cook time in minutes. */
  timeMinutes?: string | number | null
  notes?: string | null
}

function ingredientLine(row: IngredientRow): string {
  const name = row.name.trim()
  const price = parseFloat(row.price)
  const grams = parseFloat(row.grams ?? '')
  const hasPrice = !isNaN(price) && price > 0
  const hasGrams = !isNaN(grams) && grams > 0

  let line: string
  if (hasGrams) line = `${name}|${hasPrice ? price.toFixed(2) : ''}|${grams}`
  else line = hasPrice ? `${name}|${price.toFixed(2)}` : name

  if (row.ignorePrice) line += `|${INGREDIENT_PRICE_IGNORE_FLAG}`
  return line
}

export function buildDescription(input: BuildDescriptionInput): string {
  const {
    ingredientRows,
    steps,
    nutrition,
    priceOverride,
    category,
    portions,
    verified,
    origin,
    location,
    locationCoords,
    timeMinutes,
    notes,
  } = input

  const parts: string[] = []
  const isRestaurant = origin === 'restaurante'

  const filled = isRestaurant ? [] : ingredientRows.filter((r) => r.name.trim())
  if (filled.length > 0) {
    parts.push(`[Ingredientes]\n${filled.map(ingredientLine).join('\n')}`)
  }

  if (!isRestaurant && steps.trim()) parts.push(`[Passos]\n${steps.trim()}`)

  const { calories, protein, carbs, fat } = nutrition
  if (calories || protein || carbs || fat) {
    parts.push(
      `[Nutricao]\ncalories:${calories || 0}\nprotein:${protein || 0}\ncarbs:${carbs || 0}\nfat:${fat || 0}`
    )
  }

  const autoReady = isRestaurant ? 0 : readyAutoTotal(ingredientRows)
  const finalPrice = priceOverride !== '' ? parseFloat(priceOverride) : autoReady
  if (!isNaN(finalPrice) && finalPrice > 0) {
    parts.push(`[Preco]\n${finalPrice.toFixed(2)}`)
  }

  if (category?.trim()) parts.push(`[Categoria]\n${category.trim()}`)
  if (origin) parts.push(`[Origem]\n${origin}`)
  if (location?.trim()) parts.push(`[Local]\n${location.trim()}`)
  if (
    locationCoords &&
    Number.isFinite(locationCoords.latitude) &&
    Number.isFinite(locationCoords.longitude)
  ) {
    parts.push(`[Coords]\n${locationCoords.latitude},${locationCoords.longitude}`)
  }
  if (portions !== undefined && portions !== null && portions >= 0) parts.push(`[Porcoes]\n${portions}`)

  const mins = typeof timeMinutes === 'string' ? parseInt(timeMinutes, 10) : timeMinutes
  if (mins !== undefined && mins !== null && !isNaN(mins) && mins > 0) {
    parts.push(`[Tempo]\n${mins}`)
  }

  if (verified && verified.size > 0) parts.push(formatVerifiedSection(verified))
  if (notes?.trim()) parts.push(`[Notas]\n${notes.trim()}`)

  return parts.join('\n\n')
}

export function decrementPortions(description: string): string {
  return description.replace(/(\[Porcoes\]\n)(\d+)/, (_, prefix, n) =>
    `${prefix}${Math.max(0, parseInt(n, 10) - 1)}`
  )
}

export function addPortions(description: string, amount: number): string {
  if (/\[Porcoes\]/.test(description)) {
    return description.replace(/(\[Porcoes\]\n)(\d+)/, (_, prefix, n) =>
      `${prefix}${parseInt(n, 10) + amount}`
    )
  }
  const base = description.trim()
  return base ? `${base}\n\n[Porcoes]\n${amount}` : `[Porcoes]\n${amount}`
}
