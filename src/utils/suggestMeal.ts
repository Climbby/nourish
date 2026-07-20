import type { MealPlanEntry, Recipe } from '../types/grocy'
import { parseDescription } from './parseDescription'

export type SuggestionPreference = 'balanced' | 'cheap' | 'taste'

export interface SuggestionContext {
  recipes: Recipe[]
  favourites: Set<number>
  mealPlan: MealPlanEntry[]
}

const PREF_STORAGE_KEY = 'nourish-suggestion-preference'

export function loadSuggestionPreference(): SuggestionPreference {
  try {
    const raw = localStorage.getItem(PREF_STORAGE_KEY)
    if (raw === 'cheap' || raw === 'taste' || raw === 'balanced') return raw
  } catch {
    /* ignore */
  }
  return 'taste'
}

export function saveSuggestionPreference(preference: SuggestionPreference): void {
  try {
    localStorage.setItem(PREF_STORAGE_KEY, preference)
  } catch {
    /* ignore */
  }
}

function recentRecipeIds(mealPlan: MealPlanEntry[], withinHours = 48): Set<number> {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000
  const ids = new Set<number>()
  for (const entry of mealPlan) {
    const ts = entry.row_created_timestamp?.replace(' ', 'T')
    if (!ts) continue
    if (new Date(ts).getTime() >= cutoff) ids.add(entry.recipe_id)
  }
  return ids
}

function mealFrequency(mealPlan: MealPlanEntry[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const entry of mealPlan) {
    counts.set(entry.recipe_id, (counts.get(entry.recipe_id) ?? 0) + 1)
  }
  return counts
}

/** Median price across recipes that have `[Preco]`. */
export function medianRecipePrice(recipes: Recipe[]): number | null {
  const prices = recipes
    .map((r) => parseDescription(r.description ?? '').price)
    .filter((p): p is number => p !== null && p > 0)
    .sort((a, b) => a - b)
  if (prices.length === 0) return null
  const mid = Math.floor(prices.length / 2)
  return prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid]
}

/** Portions, nutrition presence, category. */
export function scoreBasicAttributes(recipe: Recipe): number {
  const { portions, category, nutrition } = parseDescription(recipe.description ?? '')
  let score = 0
  if ((portions ?? 0) > 0) score += 6
  if (nutrition) score += 2
  if (category === 'Completa') score += 1
  return score
}

/**
 * Cheap → lower price vs catalog median.
 * Taste (Preferidos) → favourites, but penalise often/recently eaten to avoid repeats.
 * Balanced (Nutritivo) → no extra bias.
 */
export function scorePreference(
  recipe: Recipe,
  ctx: Pick<SuggestionContext, 'favourites' | 'mealPlan'>,
  preference: SuggestionPreference,
  priceAnchor: number | null,
  frequency: Map<number, number> = mealFrequency(ctx.mealPlan)
): number {
  if (preference === 'balanced') return 0

  const { price, category } = parseDescription(recipe.description ?? '')

  if (preference === 'cheap') {
    if (price === null || price <= 0) return -2
    if (!priceAnchor || priceAnchor <= 0) return 4
    return ((priceAnchor - price) / priceAnchor) * 14
  }

  // taste / Preferidos
  let score = 0
  if (ctx.favourites.has(recipe.id)) score += 8
  const timesEaten = frequency.get(recipe.id) ?? 0
  score -= Math.min(10, timesEaten * 2)
  if (recentRecipeIds(ctx.mealPlan).has(recipe.id)) score -= 6
  if (recipe.picture_file_name) score += 1
  if (category === 'Completa') score += 1
  return score
}

/** Always avoids recently eaten meals; favourites only via Preferidos preference. */
export function scoreRecipe(
  recipe: Recipe,
  ctx: Pick<SuggestionContext, 'favourites' | 'mealPlan'>,
  excludeIds: Set<number> = new Set(),
  preference: SuggestionPreference = 'taste',
  priceAnchor: number | null = null,
  frequency?: Map<number, number>
): number {
  if (excludeIds.has(recipe.id)) return -999

  let score = scoreBasicAttributes(recipe)

  const recent = recentRecipeIds(ctx.mealPlan)
  if (!recent.has(recipe.id)) score += 2
  if (recent.has(recipe.id)) score -= 5

  score += scorePreference(recipe, ctx, preference, priceAnchor, frequency)

  return score
}

export function pickMealSuggestion(
  ctx: SuggestionContext,
  preference: SuggestionPreference = 'taste'
): Recipe | null {
  const { recipes } = ctx
  if (recipes.length === 0) return null

  const priceAnchor = preference === 'cheap' ? medianRecipePrice(recipes) : null
  const frequency = preference === 'taste' ? mealFrequency(ctx.mealPlan) : new Map()

  const scored = recipes.map((recipe) => ({
    recipe,
    score: scoreRecipe(recipe, ctx, new Set(), preference, priceAnchor, frequency),
  }))

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score <= 0) {
    const recent = recentRecipeIds(ctx.mealPlan)
    const fallback = recipes.find((r) => !recent.has(r.id))
    return fallback ?? recipes[0]
  }
  return best.recipe
}

export interface DaySuggestion {
  dayLabel: string
  dayOffset: number
  recipe: Recipe
}

const PT_DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function dayLabelForOffset(offset: number, date = new Date()): string {
  if (offset === 0) return 'Hoje'
  if (offset === 1) return 'Amanhã'
  const d = new Date(date)
  d.setDate(date.getDate() + offset)
  return PT_DAY_NAMES[d.getDay()]
}

export function pickWeeklySuggestions(
  ctx: SuggestionContext,
  days = 7,
  preference: SuggestionPreference = 'taste'
): DaySuggestion[] {
  const { recipes } = ctx
  if (recipes.length === 0) return []

  const picked = new Set<number>()
  const result: DaySuggestion[] = []
  const today = new Date()
  const priceAnchor = preference === 'cheap' ? medianRecipePrice(recipes) : null
  const frequency = preference === 'taste' ? mealFrequency(ctx.mealPlan) : new Map()

  for (let i = 0; i < days; i++) {
    const candidates = recipes
      .filter((r) => !picked.has(r.id))
      .map((r) => ({
        recipe: r,
        score: scoreRecipe(r, ctx, picked, preference, priceAnchor, frequency),
      }))
      .sort((a, b) => b.score - a.score)

    const best = candidates[0]
    if (!best) break

    picked.add(best.recipe.id)
    result.push({
      dayLabel: dayLabelForOffset(i, today),
      dayOffset: i,
      recipe: best.recipe,
    })
  }

  return result
}
