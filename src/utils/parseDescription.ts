import { stripHtml } from './stripHtml'
import { isVerifiedField, type VerifiedField } from './verification'

export interface Nutrition {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface IngredientLine {
  name: string
  price: number | null
}

export interface ParsedRecipe {
  ingredients: string | null
  ingredientItems: IngredientLine[]
  steps: string | null
  nutrition: Nutrition | null
  price: number | null
  category: string | null
  portions: number | null
  verified: VerifiedField[]
  /** `supermercado` | `restaurante` — null if unset (legacy) */
  origin: string | null
  /** Optional place name for restaurant meals (future use) */
  location: string | null
}

export function parseDescription(raw: string): ParsedRecipe {
  const text = stripHtml(raw ?? '')

  const sections: Record<string, string> = {}
  let currentKey: string | null = null

  for (const line of text.split('\n')) {
    const match = line.match(/^\[(Ingredientes|Passos|Nutricao|Preco|Categoria|Porcoes|Verificado|Origem|Local)\]$/)
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
      verified: [],
      origin: null,
      location: null,
    }
  }

  const rawIngredients = sections['Ingredientes']?.trim() || null
  const ingredientItems: IngredientLine[] = rawIngredients
    ? rawIngredients.split('\n').filter(Boolean).map((line) => {
        const pipeIdx = line.lastIndexOf('|')
        if (pipeIdx === -1) return { name: line.trim(), price: null }
        const name = line.slice(0, pipeIdx).trim()
        const val = parseFloat(line.slice(pipeIdx + 1).trim())
        return { name, price: isNaN(val) ? null : val }
      })
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
  const location = sections['Local']?.trim() || null

  let portions: number | null = null
  if (sections['Porcoes'] !== undefined) {
    const val = parseInt(sections['Porcoes'].trim(), 10)
    if (!isNaN(val)) portions = val
  }

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
    verified,
    origin,
    location,
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
