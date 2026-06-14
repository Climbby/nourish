import type { MealPlanEntry, Recipe } from '../types/grocy'
import { parseDescription } from './parseDescription'

export interface SuggestionContext {
  recipes: Recipe[]
  favourites: Set<number>
  mealPlan: MealPlanEntry[]
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

export function scoreRecipe(
  recipe: Recipe,
  ctx: Pick<SuggestionContext, 'favourites' | 'mealPlan'>,
  excludeIds: Set<number> = new Set()
): number {
  if (excludeIds.has(recipe.id)) return -999

  const recent = recentRecipeIds(ctx.mealPlan)
  const { portions } = parseDescription(recipe.description ?? '')
  let score = 0
  if ((portions ?? 0) > 0) score += 6
  if (ctx.favourites.has(recipe.id)) score += 3
  if (!recent.has(recipe.id)) score += 2
  if (recent.has(recipe.id)) score -= 5
  return score
}

export function pickMealSuggestion(ctx: SuggestionContext): Recipe | null {
  const { recipes } = ctx
  if (recipes.length === 0) return null

  const recent = recentRecipeIds(ctx.mealPlan)

  const scored = recipes.map((recipe) => ({
    recipe,
    score: scoreRecipe(recipe, ctx),
  }))

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score <= 0) {
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

export function pickWeeklySuggestions(ctx: SuggestionContext, days = 7): DaySuggestion[] {
  const { recipes } = ctx
  if (recipes.length === 0) return []

  const picked = new Set<number>()
  const result: DaySuggestion[] = []
  const today = new Date()

  for (let i = 0; i < days; i++) {
    const candidates = recipes
      .filter((r) => !picked.has(r.id))
      .map((r) => ({ recipe: r, score: scoreRecipe(r, ctx, picked) }))
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
