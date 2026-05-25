import { stripHtml } from './stripHtml'

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
}

export function parseDescription(raw: string): ParsedRecipe {
  const text = stripHtml(raw ?? '')

  const sections: Record<string, string> = {}
  let currentKey: string | null = null

  for (const line of text.split('\n')) {
    const match = line.match(/^\[(Ingredientes|Passos|Nutricao|Preco|Categoria|Porcoes)\]$/)
    if (match) {
      currentKey = match[1]
      sections[currentKey] = ''
    } else if (currentKey !== null) {
      sections[currentKey] += (sections[currentKey] ? '\n' : '') + line
    }
  }

  if (Object.keys(sections).length === 0) {
    return { ingredients: null, ingredientItems: [], steps: text || null, nutrition: null, price: null, category: null, portions: null }
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

  let portions: number | null = null
  if (sections['Porcoes'] !== undefined) {
    const val = parseInt(sections['Porcoes'].trim(), 10)
    if (!isNaN(val)) portions = val
  }

  return {
    ingredients: rawIngredients,
    ingredientItems,
    steps: sections['Passos']?.trim() || null,
    nutrition,
    price,
    category,
    portions,
  }
}
