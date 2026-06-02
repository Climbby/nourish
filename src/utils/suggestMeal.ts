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

export function pickMealSuggestion(ctx: SuggestionContext): Recipe | null {
  const { recipes, favourites, mealPlan } = ctx
  if (recipes.length === 0) return null

  const recent = recentRecipeIds(mealPlan)

  const scored = recipes.map((recipe) => {
    const { portions } = parseDescription(recipe.description ?? '')
    let score = 0
    if ((portions ?? 0) > 0) score += 6
    if (favourites.has(recipe.id)) score += 3
    if (!recent.has(recipe.id)) score += 2
    if (recent.has(recipe.id)) score -= 5
    return { recipe, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score <= 0) {
    const fallback = recipes.find((r) => !recent.has(r.id))
    return fallback ?? recipes[0]
  }
  return best.recipe
}
