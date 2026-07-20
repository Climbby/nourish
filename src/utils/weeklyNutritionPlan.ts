import { DEFAULT_TARGETS, type NutritionTargets } from '../hooks/useNutritionTargets'
import type { Recipe } from '../types/grocy'
import { parseDescription, type Nutrition } from './parseDescription'
import {
  dayLabelForOffset,
  medianRecipePrice,
  scoreRecipe,
  type SuggestionContext,
  type SuggestionPreference,
} from './suggestMeal'

export type MacroKey = 'calories' | 'protein' | 'carbs' | 'fat'

export interface DaySuggestion {
  dayLabel: string
  dayOffset: number
  recipe: Recipe
  /** Short label shown on the card, e.g. "Proteína" */
  focus: string
  /** One line explaining why this meal fits the plan */
  reason: string
}

export interface WeekPlanTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
  daysWithNutrition: number
  /** Sum of `[Preco]` across meals that have a price */
  spend: number
  mealsWithPrice: number
}

const MACRO_LABEL: Record<MacroKey, string> = {
  calories: 'Calorias',
  protein: 'Proteína',
  carbs: 'Hidratos',
  fat: 'Gordura',
}

const FOCUS_SHORT: Record<MacroKey, string> = {
  calories: 'Energia',
  protein: 'Proteína',
  carbs: 'Hidratos',
  fat: 'Gordura',
}

/** Main meal ≈ 85% of daily targets */
const MEAL_SHARE = 0.85

function macroValue(key: MacroKey, n: Nutrition): number {
  return key === 'calories' ? n.calories : n[key]
}

function emptyTotals(): WeekPlanTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, daysWithNutrition: 0, spend: 0, mealsWithPrice: 0 }
}

export function emptyWeekTotals(): WeekPlanTotals {
  return emptyTotals()
}

export function sumWeekPlanNutrition(suggestions: DaySuggestion[]): WeekPlanTotals {
  const totals = emptyTotals()
  for (const { recipe } of suggestions) {
    const { nutrition, price } = parseDescription(recipe.description ?? '')
    if (nutrition) {
      totals.calories += nutrition.calories
      totals.protein += nutrition.protein
      totals.carbs += nutrition.carbs
      totals.fat += nutrition.fat
      totals.daysWithNutrition++
    }
    if (price !== null) {
      totals.spend += price
      totals.mealsWithPrice++
    }
  }
  return totals
}

export function weekTargetTotals(targets: NutritionTargets, days: number) {
  return {
    calories: targets.caloriesPerDay * days,
    protein: targets.proteinPerDay * days,
    carbs: targets.carbsPerDay * days,
    fat: targets.fatPerDay * days,
  }
}

function relativeGap(key: MacroKey, running: Nutrition, expected: Nutrition): number {
  const exp = macroValue(key, expected)
  if (exp <= 0) return 0
  const have = macroValue(key, running)
  return (exp - have) / exp
}

function pickFocusMacro(
  running: Nutrition,
  cumulativeExpected: Nutrition,
  dailyTargets: Nutrition,
  meal: Nutrition
): MacroKey {
  const keys: MacroKey[] = ['protein', 'calories', 'carbs', 'fat']
  let best: MacroKey = 'protein'
  let bestScore = -Infinity

  for (const key of keys) {
    const gap = relativeGap(key, running, cumulativeExpected)
    const val = macroValue(key, meal)
    const dailyIdeal = macroValue(key, dailyTargets) * MEAL_SHARE
    const fill = dailyIdeal > 0 ? val / dailyIdeal : 0
    const score = gap > 0 ? gap * fill : val * gap
    if (score > bestScore) {
      bestScore = score
      best = key
    }
  }
  return best
}

function buildReason(
  preference: SuggestionPreference,
  focus: MacroKey,
  running: Nutrition,
  dayExpected: Nutrition,
  meal: Nutrition,
  hasPortions: boolean,
  category: string | null,
  price: number | null,
  isFavourite: boolean
): string {
  if (preference === 'cheap' && price !== null) {
    return hasPortions
      ? `€${price.toFixed(2)} · porções prontas`
      : `Opção económica · €${price.toFixed(2)}`
  }
  if (preference === 'taste') {
    if (isFavourite) return 'Dos teus preferidos'
    if (hasPortions) return 'Porções prontas · boa escolha'
    return `Preferido · ${Math.round(meal.calories)} kcal`
  }

  if (hasPortions) {
    return `${FOCUS_SHORT[focus]} · porções prontas no frigorífico`
  }

  const calGap = relativeGap('calories', running, dayExpected)

  if (calGap < -0.15 && focus === 'calories') {
    return 'Refeição mais leve — semana acima em calorias'
  }
  if (relativeGap(focus, running, dayExpected) > 0.08) {
    return `Reforça ${MACRO_LABEL[focus].toLowerCase()} — abaixo do plano`
  }
  const p = meal.protein
  if (p >= 25 && focus === 'protein') {
    return 'Boa fonte de proteína para equilibrar a semana'
  }
  if (category === 'Completa') return `Completa · ${Math.round(meal.calories)} kcal`
  return `Equilibrada · ${Math.round(meal.calories)} kcal`
}

function nutritionScore(
  meal: Nutrition,
  running: Nutrition,
  cumulativeExpected: Nutrition,
  dailyTargets: Nutrition,
  weekBehind: MacroKey | null
): number {
  let score = 0
  const keys: MacroKey[] = ['calories', 'protein', 'carbs', 'fat']

  for (const key of keys) {
    const gap = relativeGap(key, running, cumulativeExpected)
    const val = macroValue(key, meal)
    const dailyIdeal = macroValue(key, dailyTargets) * MEAL_SHARE

    if (gap > 0.05) {
      score += Math.min(3, val / Math.max(1, dailyIdeal)) * gap * 10
    } else if (gap < -0.12) {
      score -= val / Math.max(1, dailyIdeal) * Math.abs(gap) * 8
    }
  }

  if (weekBehind) {
    score += macroValue(weekBehind, meal) / 40
  }

  const calIdeal = dailyTargets.calories * MEAL_SHARE
  if (calIdeal > 0) {
    const dist = Math.abs(meal.calories - calIdeal) / calIdeal
    score += Math.max(0, 1.5 - dist)
  }

  return score
}

/**
 * Pick a balanced week of meals against profile targets (fallback DEFAULT_TARGETS),
 * always avoiding recently eaten meals. `preference` adds Preferidos / Barato / Nutritivo bias.
 */
export function pickBalancedWeeklySuggestions(
  ctx: SuggestionContext,
  targets: NutritionTargets,
  days = 7,
  now = new Date(),
  preference: SuggestionPreference = 'taste'
): DaySuggestion[] {
  const recipes = ctx.recipes.filter((r) => {
    const { category } = parseDescription(r.description ?? '')
    return category === 'Completa'
  })
  if (recipes.length === 0) return []

  const poolCtx: SuggestionContext = { ...ctx, recipes }

  const effectiveTargets = targets.caloriesPerDay > 0 ? targets : DEFAULT_TARGETS

  const priceAnchor = preference === 'cheap' ? medianRecipePrice(recipes) : null
  const picked = new Set<number>()
  const running = emptyTotals()
  const result: DaySuggestion[] = []

  const dailyTargets: Nutrition = {
    calories: effectiveTargets.caloriesPerDay,
    protein: effectiveTargets.proteinPerDay,
    carbs: effectiveTargets.carbsPerDay,
    fat: effectiveTargets.fatPerDay,
  }

  for (let i = 0; i < days; i++) {
    const cumulativeExpected = {
      calories: effectiveTargets.caloriesPerDay * (i + 1),
      protein: effectiveTargets.proteinPerDay * (i + 1),
      carbs: effectiveTargets.carbsPerDay * (i + 1),
      fat: effectiveTargets.fatPerDay * (i + 1),
    }
    const runningNutrition: Nutrition = {
      calories: running.calories,
      protein: running.protein,
      carbs: running.carbs,
      fat: running.fat,
    }

    const gaps: { key: MacroKey; gap: number }[] = (
      ['protein', 'calories', 'carbs', 'fat'] as MacroKey[]
    ).map((key) => ({ key, gap: relativeGap(key, runningNutrition, cumulativeExpected) }))
    gaps.sort((a, b) => b.gap - a.gap)
    const weekBehind = gaps[0]?.gap > 0.06 ? gaps[0].key : null

    const candidates = recipes
      .filter((r) => !picked.has(r.id))
      .map((recipe) => {
        const parsed = parseDescription(recipe.description ?? '')
        const base = scoreRecipe(recipe, poolCtx, picked, preference, priceAnchor)
        let score = base

        if (parsed.nutrition) {
          const nutritionWeight = preference === 'balanced' ? 1 : 0.55
          score +=
            nutritionScore(
              parsed.nutrition,
              runningNutrition,
              cumulativeExpected,
              dailyTargets,
              weekBehind
            ) * nutritionWeight
        } else {
          score -= 4
        }

        return { recipe, parsed, score }
      })
      .sort((a, b) => b.score - a.score)

    const best = candidates[0]
    if (!best) break

    picked.add(best.recipe.id)
    const { nutrition, portions, category, price } = best.parsed
    const hasPortions = (portions ?? 0) > 0
    const isFavourite = poolCtx.favourites.has(best.recipe.id)

    let focus: MacroKey = 'calories'
    let reason = hasPortions
      ? 'Porções prontas no frigorífico'
      : 'Completa · variedade para a semana'

    if (nutrition) {
      focus = pickFocusMacro(runningNutrition, cumulativeExpected, dailyTargets, nutrition)
      reason = buildReason(
        preference,
        focus,
        runningNutrition,
        cumulativeExpected,
        nutrition,
        hasPortions,
        category,
        price,
        isFavourite
      )
      running.calories += nutrition.calories
      running.protein += nutrition.protein
      running.carbs += nutrition.carbs
      running.fat += nutrition.fat
      running.daysWithNutrition++
    } else if (preference === 'cheap' && price !== null) {
      reason = `Opção económica · €${price.toFixed(2)}`
    } else if (preference === 'taste' && isFavourite) {
      reason = 'Dos teus preferidos'
    }

    result.push({
      dayLabel: dayLabelForOffset(i, now),
      dayOffset: i,
      recipe: best.recipe,
      focus: FOCUS_SHORT[focus],
      reason,
    })
  }

  return result
}

export function plannedWeekProgress(
  plannedTotals: WeekPlanTotals,
  targets: NutritionTargets,
  plannedDays: number
) {
  const expected = weekTargetTotals(targets, plannedDays)
  const pct =
    expected.calories > 0
      ? Math.round((plannedTotals.calories / expected.calories) * 100)
      : 0
  return { expected, pct: Math.min(150, pct) }
}
