/**
 * Per-100 g macros stored on the product, so recipe nutrition can be *derived*
 * instead of guessed. Follows the same description-as-storage pattern as
 * [BuyAmount] and friends.
 *
 * Sources, in descending order of trust:
 *  - `rotulo` — read off the packaging nutrition table (legally required, accurate)
 *  - `insa`   — Tabela da Composição de Alimentos (INSA), for unpackaged fresh food
 *  - `manual` — typed in by hand
 */

import type { IngredientLine } from './parseDescription'
import type { Nutrition } from './parseDescription'

export type MacroSource = 'rotulo' | 'insa' | 'manual'

export const MACRO_SOURCES: MacroSource[] = ['rotulo', 'insa', 'manual']

export const MACRO_SOURCE_LABELS: Record<MacroSource, string> = {
  rotulo: 'Rótulo',
  insa: 'INSA',
  manual: 'Manual',
}

export function isMacroSource(value: unknown): value is MacroSource {
  return typeof value === 'string' && (MACRO_SOURCES as string[]).includes(value)
}

/** Macros per 100 g (or 100 ml for liquids). */
export interface ProductMacros {
  calories: number
  protein: number
  carbs: number
  fat: number
  fibre: number
  source: MacroSource
}

const SECTION = 'Nutricao100'

function readNumber(block: string, key: string): number {
  const m = block.match(new RegExp(`^${key}:\\s*(-?\\d+(?:\\.\\d+)?)\\s*$`, 'm'))
  if (!m) return 0
  const val = parseFloat(m[1])
  return isNaN(val) || val < 0 ? 0 : val
}

/** Read the [Nutricao100] block from a product description. */
export function getMacrosFromDesc(description: string | null): ProductMacros | null {
  if (!description) return null
  const m = description.match(/\[Nutricao100\]\n([\s\S]*?)(?=\n\[|$)/)
  if (!m) return null
  const block = m[1]

  const sourceMatch = block.match(/^source:\s*(\w+)\s*$/m)
  const source = isMacroSource(sourceMatch?.[1]) ? sourceMatch[1] : 'manual'

  const macros: ProductMacros = {
    calories: readNumber(block, 'calories'),
    protein: readNumber(block, 'protein'),
    carbs: readNumber(block, 'carbs'),
    fat: readNumber(block, 'fat'),
    fibre: readNumber(block, 'fibre'),
    source,
  }

  // An all-zero block carries no information — treat it as absent so callers
  // can tell "not filled in yet" from "genuinely zero".
  if (!macros.calories && !macros.protein && !macros.carbs && !macros.fat && !macros.fibre) {
    return null
  }
  return macros
}

export function formatMacrosSection(macros: ProductMacros): string {
  return [
    `[${SECTION}]`,
    `calories:${macros.calories}`,
    `protein:${macros.protein}`,
    `carbs:${macros.carbs}`,
    `fat:${macros.fat}`,
    `fibre:${macros.fibre}`,
    `source:${macros.source}`,
  ].join('\n')
}

/**
 * Insert or replace the [Nutricao100] block in a description, leaving every
 * other section untouched. Passing null removes the block.
 */
export function upsertMacrosSection(
  description: string | null,
  macros: ProductMacros | null
): string {
  const base = (description ?? '').trim()
  const stripped = base.replace(/\n*\[Nutricao100\]\n[\s\S]*?(?=\n\[|$)/, '').trim()
  if (!macros) return stripped
  return stripped ? `${stripped}\n\n${formatMacrosSection(macros)}` : formatMacrosSection(macros)
}

// ── Deriving recipe nutrition from ingredient quantities ─────────────────────

export interface DerivedNutrition extends Nutrition {
  fibre: number
  /** Ingredients that had grams AND a product with macros. */
  resolved: number
  /** Ingredients with grams but no product macros on file. */
  missingMacros: string[]
  /** Ingredients with no quantity, so they cannot count at all. */
  missingGrams: string[]
}

export function emptyDerivedNutrition(): DerivedNutrition {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fibre: 0,
    resolved: 0,
    missingMacros: [],
    missingGrams: [],
  }
}

/**
 * Sum ingredient macros and divide by portions. `lookup` returns the per-100 g
 * macros for an ingredient name (however the caller chooses to match it).
 *
 * Returns totals for the whole recipe when `portions` is null or < 1, so a
 * missing portion count never silently divides the numbers.
 */
export function deriveRecipeNutrition(
  ingredients: IngredientLine[],
  lookup: (ingredientName: string) => ProductMacros | null,
  portions: number | null
): DerivedNutrition {
  const out = emptyDerivedNutrition()

  for (const ing of ingredients) {
    if (ing.grams === null || ing.grams <= 0) {
      if (ing.name.trim()) out.missingGrams.push(ing.name)
      continue
    }
    const macros = lookup(ing.name)
    if (!macros) {
      out.missingMacros.push(ing.name)
      continue
    }
    const factor = ing.grams / 100
    out.calories += macros.calories * factor
    out.protein += macros.protein * factor
    out.carbs += macros.carbs * factor
    out.fat += macros.fat * factor
    out.fibre += macros.fibre * factor
    out.resolved++
  }

  const divisor = portions !== null && portions >= 1 ? portions : 1
  out.calories = Math.round(out.calories / divisor)
  out.protein = Math.round((out.protein / divisor) * 10) / 10
  out.carbs = Math.round((out.carbs / divisor) * 10) / 10
  out.fat = Math.round((out.fat / divisor) * 10) / 10
  out.fibre = Math.round((out.fibre / divisor) * 10) / 10

  return out
}

/** True when every ingredient contributed, so the totals can be trusted. */
export function isNutritionComplete(derived: DerivedNutrition): boolean {
  return (
    derived.resolved > 0 &&
    derived.missingMacros.length === 0 &&
    derived.missingGrams.length === 0
  )
}
