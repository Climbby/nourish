import type { VerifiedField } from './verification'
import { formatVerifiedSection } from './verification'
import type { MealOrigin } from './mealOrigin'

export interface IngredientRow {
  id: number
  name: string
  price: string
  /** Quantity in grams (or ml). Optional — blank rows still round-trip. */
  grams?: string
  /** Count of Despensa stock units when the product has UnitGrams. */
  qty?: string
  /** Linked Despensa product (form-only; resolved into name|€|g on save). */
  productId?: number
  /** Cached UnitGrams from the linked product. */
  unitGrams?: number | null
}

export interface BuildDescriptionInput {
  ingredientRows: IngredientRow[]
  steps: string
  nutrition: { calories: string; protein: string; carbs: string; fat: string }
  priceOverride: string
  autoTotal: number
  category?: string
  portions?: number | null
  verified?: Set<VerifiedField>
  origin?: MealOrigin | null
  location?: string | null
  locationCoords?: { latitude: number; longitude: number } | null
  /** Cook time in minutes. */
  timeMinutes?: string | number | null
  notes?: string | null
}

export function computeAutoTotal(rows: IngredientRow[]): number {
  return rows.reduce((sum, r) => {
    const p = parseFloat(r.price)
    return isNaN(p) ? sum : sum + p
  }, 0)
}

function ingredientLine(row: IngredientRow): string {
  const name = row.name.trim()
  const price = parseFloat(row.price)
  const grams = parseFloat(row.grams ?? '')
  const hasPrice = !isNaN(price) && price > 0
  const hasGrams = !isNaN(grams) && grams > 0

  if (hasGrams) return `${name}|${hasPrice ? price.toFixed(2) : ''}|${grams}`
  return hasPrice ? `${name}|${price.toFixed(2)}` : name
}

export function buildDescription(input: BuildDescriptionInput): string {
  const {
    ingredientRows,
    steps,
    nutrition,
    priceOverride,
    autoTotal,
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

  const finalPrice = priceOverride !== '' ? parseFloat(priceOverride) : autoTotal
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
