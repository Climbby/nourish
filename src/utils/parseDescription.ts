import { stripHtml } from './stripHtml'
import { isVerifiedField, type VerifiedField } from './verification'

export interface Nutrition {
  calories: number
  protein: number
  carbs: number
  fat: number
}

/** Trailing `|i` on an ingredient line: keep the ingredient, skip € and quantity. */
export const INGREDIENT_PRICE_IGNORE_FLAG = 'i'

export interface IngredientLine {
  name: string
  price: number | null
  /** Quantity in grams (or ml), used to derive nutrition from product macros. */
  grams: number | null
  /** Skip € sum and nutrition grams (e.g. a pinch of salt). */
  ignorePrice?: boolean
}

export interface ParsedRecipe {
  ingredients: string | null
  ingredientItems: IngredientLine[]
  steps: string | null
  nutrition: Nutrition | null
  price: number | null
  category: string | null
  portions: number | null
  /** Cook time in minutes — an estimate until replaced by a measured time. */
  timeMinutes: number | null
  /** Free-text notes that accumulate as the recipe gets repeated. */
  notes: string | null
  verified: VerifiedField[]
  /** `supermercado` | `restaurante` — null if unset (legacy) */
  origin: string | null
  /** Restaurant name for eat-out meals (`[Local]`), e.g. "Cantina do ISCTE" */
  location: string | null
  /** Coords for distance on meal detail and Fora sort */
  locationCoords: { latitude: number; longitude: number } | null
}

function parseCoordsBlock(raw: string | undefined): { latitude: number; longitude: number } | null {
  if (!raw) return null
  const line = raw.trim().split('\n')[0]?.trim() ?? ''
  const m = line.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const latitude = parseFloat(m[1])
  const longitude = parseFloat(m[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

function parseLocalLabel(raw: string | undefined): string | null {
  if (!raw) return null
  const first = raw.trim().split('\n')[0]?.trim() ?? ''
  return first || null
}

function numOrNull(raw: string | undefined): number | null {
  const val = parseFloat((raw ?? '').trim())
  return isNaN(val) ? null : val
}

function isPriceIgnoreFlag(value: string): boolean {
  return value.trim().toLowerCase() === INGREDIENT_PRICE_IGNORE_FLAG
}

/**
 * Ingredient lines are `Nome`, `Nome|preco`, or `Nome|preco|gramas` (with the
 * price optionally blank: `Nome||gramas`). An optional trailing `|i` skips
 * this line for meal € and for derived nutrition (quantity not required).
 * Names containing a literal `|` still parse the way they always did.
 */
export function parseIngredientLine(line: string): IngredientLine {
  const rawParts = line.split('|')
  let ignorePrice = false
  let body = line
  if (rawParts.length >= 2 && isPriceIgnoreFlag(rawParts[rawParts.length - 1])) {
    ignorePrice = true
    body = rawParts.slice(0, -1).join('|')
  }

  const parts = body.split('|')

  if (parts.length >= 3) {
    const grams = numOrNull(parts[parts.length - 1])
    const priceRaw = parts[parts.length - 2].trim()
    const price = numOrNull(priceRaw)
    // Only read the 3-field form when the trailing fields really are numeric —
    // otherwise fall through to the legacy `name|price` split below.
    if (grams !== null && (price !== null || priceRaw === '')) {
      return {
        name: parts.slice(0, -2).join('|').trim(),
        price,
        grams,
        ...(ignorePrice ? { ignorePrice: true } : {}),
      }
    }
  }

  const pipeIdx = body.lastIndexOf('|')
  if (pipeIdx === -1) {
    return { name: body.trim(), price: null, grams: null, ...(ignorePrice ? { ignorePrice: true } : {}) }
  }
  return {
    name: body.slice(0, pipeIdx).trim(),
    price: numOrNull(body.slice(pipeIdx + 1)),
    grams: null,
    ...(ignorePrice ? { ignorePrice: true } : {}),
  }
}

export function parseDescription(raw: string): ParsedRecipe {
  const text = stripHtml(raw ?? '')

  const sections: Record<string, string> = {}
  let currentKey: string | null = null

  for (const line of text.split('\n')) {
    const match = line.match(/^\[(Ingredientes|Passos|Nutricao|Preco|Categoria|Porcoes|Verificado|Origem|Local|Coords|Tempo|Notas)\]$/)
    if (match) {
      currentKey = match[1]
      sections[currentKey] = ''
    } else if (currentKey !== null) {
      sections[currentKey] += (sections[currentKey] ? '\n' : '') + line
    }
  }

  if (Object.keys(sections).length === 0) {
    return {
      ingredients: null,
      ingredientItems: [],
      steps: text || null,
      nutrition: null,
      price: null,
      category: null,
      portions: null,
      timeMinutes: null,
      notes: null,
      verified: [],
      origin: null,
      location: null,
      locationCoords: null,
    }
  }

  const rawIngredients = sections['Ingredientes']?.trim() || null
  const ingredientItems: IngredientLine[] = rawIngredients
    ? rawIngredients.split('\n').filter(Boolean).map(parseIngredientLine)
    : []

  let nutrition: Nutrition | null = null
  if (sections['Nutricao']) {
    const block = sections['Nutricao']
    const get = (key: string) => {
      const m = block.match(new RegExp(`${key}:(\\d+(?:\\.\\d+)?)`))
      return m ? parseFloat(m[1]) : 0
    }
    nutrition = {
      calories: get('calories'),
      protein: get('protein'),
      carbs: get('carbs'),
      fat: get('fat'),
    }
  }

  let price: number | null = null
  if (sections['Preco']) {
    const val = parseFloat(sections['Preco'].trim())
    if (!isNaN(val)) price = val
  }

  const category = sections['Categoria']?.trim() || null
  const origin = sections['Origem']?.trim().toLowerCase() || null
  const location = parseLocalLabel(sections['Local'])
  const locationCoords = parseCoordsBlock(sections['Coords'])

  let portions: number | null = null
  if (sections['Porcoes'] !== undefined) {
    const val = parseInt(sections['Porcoes'].trim(), 10)
    if (!isNaN(val)) portions = val
  }

  let timeMinutes: number | null = null
  if (sections['Tempo'] !== undefined) {
    const val = parseInt(sections['Tempo'].trim(), 10)
    if (!isNaN(val) && val >= 0) timeMinutes = val
  }

  const notes = sections['Notas']?.trim() || null

  const verified: VerifiedField[] = []
  if (sections['Verificado']) {
    for (const line of sections['Verificado'].split('\n')) {
      const key = line.trim().toLowerCase()
      if (isVerifiedField(key)) verified.push(key)
    }
  }

  return {
    ingredients: rawIngredients,
    ingredientItems,
    steps: sections['Passos']?.trim() || null,
    nutrition,
    price,
    category,
    portions,
    timeMinutes,
    notes,
    verified,
    origin,
    location,
    locationCoords,
  }
}

function stripStepPrefix(step: string): string {
  return step.replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '').trim()
}

export function parseSteps(steps: string | null): string[] {
  if (!steps) return []
  const trimmed = steps.trim()
  if (!trimmed) return []

  const lines = trimmed.split('\n').map(stripStepPrefix).filter(Boolean)
  if (lines.length > 1) return lines

  const single = lines[0] ?? trimmed

  const numbered = single
    .split(/(?=\d+[.)]\s+)/)
    .map(stripStepPrefix)
    .filter((s) => s.length > 0)
  if (numbered.length > 1) return numbered

  const sentences = single
    .split(/\.\s+(?=[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ])/)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter((s) => s.length > 3)
  if (sentences.length > 1) return sentences

  const semicolonParts = single.split(/\s*;\s+/).map(stripStepPrefix).filter((s) => s.length > 3)
  if (semicolonParts.length > 1) return semicolonParts

  return [stripStepPrefix(single)]
}

/** Normalise AI or pasted steps into one line per step (for storage in [Passos]). */
export function stepsTextFromAi(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((s) => stripStepPrefix(String(s))).filter(Boolean).join('\n')
  }
  const text = String(raw ?? '').trim()
  if (!text) return ''
  return parseSteps(text).join('\n')
}
