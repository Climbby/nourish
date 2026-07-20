import { DEFAULT_TARGETS, type NutritionTargets } from '../hooks/useNutritionTargets'
import type { MealSlot, PlannedSlot } from '../hooks/usePlannedMeals'
import type { Recipe } from '../types/grocy'
import { resolveMealOrigin, type MealOrigin } from './mealOrigin'
import { parseDescription, type Nutrition } from './parseDescription'
import {
  medianRecipePrice,
  scoreRecipe,
  type SuggestionContext,
  type SuggestionPreference,
} from './suggestMeal'
import { emptyWeekTotals, type WeekPlanTotals } from './weeklyNutritionPlan'

export const MEAL_SLOTS: MealSlot[] = ['almoco', 'jantar']

export const SLOT_LABEL: Record<MealSlot, string> = {
  almoco: 'Almoço',
  jantar: 'Jantar',
}

const PT_WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** Main meal ≈ half of daily targets when planning two Completa meals/day */
const MEAL_SHARE = 0.5

export function weekdayLabel(dayOffset: number, date = new Date()): string {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + dayOffset)
  const name = PT_WEEKDAYS[d.getDay()]
  return dayOffset === 0 ? `${name} (Hoje)` : name
}

/** Days 0..N visible: day 0 always; day k+1 if day k has any decided slot. */
export function visibleDayCount(slots: PlannedSlot[], maxDays = 7): number {
  let visible = 1
  for (let day = 0; day < maxDays - 1; day++) {
    const hasAny = slots.some((s) => s.dayOffset === day)
    if (!hasAny) break
    visible = day + 2
  }
  return Math.min(maxDays, visible)
}

function completaRecipes(recipes: Recipe[]): Recipe[] {
  return recipes.filter((r) => parseDescription(r.description ?? '').category === 'Completa')
}

function relativeGap(key: keyof Nutrition, running: Nutrition, expected: Nutrition): number {
  const exp = expected[key]
  if (exp <= 0) return 0
  return (exp - running[key]) / exp
}

function nutritionScore(
  meal: Nutrition,
  running: Nutrition,
  cumulativeExpected: Nutrition,
  dailyTargets: Nutrition
): number {
  let score = 0
  const keys: (keyof Nutrition)[] = ['calories', 'protein', 'carbs', 'fat']
  for (const key of keys) {
    const gap = relativeGap(key, running, cumulativeExpected)
    const val = meal[key]
    const dailyIdeal = dailyTargets[key] * MEAL_SHARE
    if (gap > 0.05) {
      score += Math.min(3, val / Math.max(1, dailyIdeal)) * gap * 10
    } else if (gap < -0.12) {
      score -= (val / Math.max(1, dailyIdeal)) * Math.abs(gap) * 8
    }
  }
  const calIdeal = dailyTargets.calories * MEAL_SHARE
  if (calIdeal > 0) {
    const dist = Math.abs(meal.calories - calIdeal) / calIdeal
    score += Math.max(0, 1.5 - dist)
  }
  return score
}

function runningFromSlots(
  decided: PlannedSlot[],
  recipeById: Map<number, Recipe>
): WeekPlanTotals {
  const totals = emptyWeekTotals()
  for (const s of decided) {
    if (s.recipeId == null) continue
    const recipe = recipeById.get(s.recipeId)
    if (!recipe) continue
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

export function sumRecipesNutrition(recipes: Recipe[]): WeekPlanTotals {
  const totals = emptyWeekTotals()
  for (const recipe of recipes) {
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

export function daySpend(dayOffset: number, slots: PlannedSlot[], recipeById: Map<number, Recipe>): number {
  let spend = 0
  for (const s of slots) {
    if (s.dayOffset !== dayOffset || s.recipeId == null) continue
    const recipe = recipeById.get(s.recipeId)
    if (!recipe) continue
    const { price } = parseDescription(recipe.description ?? '')
    if (price !== null) spend += price
  }
  return spend
}

/**
 * Build suggestions for every unlocked undecided slot, in order.
 * Decided meals feed running nutrition; denials exclude specific recipes per slot.
 * Each slot uses originByKey (default Casa / supermercado).
 */
export function buildSlotSuggestions(
  ctx: SuggestionContext,
  targets: NutritionTargets,
  decided: PlannedSlot[],
  deniedByKey: Record<string, number[]>,
  preference: SuggestionPreference,
  originByKey: Record<string, MealOrigin> = {},
  maxDays = 7
): Map<string, number> {
  const pool = completaRecipes(ctx.recipes)
  const recipeById = new Map(pool.map((r) => [r.id, r]))
  const effectiveTargets = targets.caloriesPerDay > 0 ? targets : DEFAULT_TARGETS

  const dailyTargets: Nutrition = {
    calories: effectiveTargets.caloriesPerDay,
    protein: effectiveTargets.proteinPerDay,
    carbs: effectiveTargets.carbsPerDay,
    fat: effectiveTargets.fatPerDay,
  }

  const priceAnchor = preference === 'cheap' ? medianRecipePrice(pool) : null
  const decidedIds = new Set(
    decided.map((s) => s.recipeId).filter((id): id is number => id != null)
  )
  const suggestions = new Map<string, number>()
  const visible = visibleDayCount(decided, maxDays)

  const ordered: { dayOffset: number; slot: MealSlot }[] = []
  for (let day = 0; day < visible; day++) {
    for (const slot of MEAL_SLOTS) ordered.push({ dayOffset: day, slot })
  }

  for (const { dayOffset, slot } of ordered) {
    const key = `${dayOffset}:${slot}`
    const existing = decided.find((s) => s.dayOffset === dayOffset && s.slot === slot)
    if (existing) continue

    const slotOrigin = originByKey[key] ?? 'supermercado'

    const prior = decided.filter(
      (s) =>
        s.dayOffset < dayOffset ||
        (s.dayOffset === dayOffset && s.slot === 'almoco' && slot === 'jantar')
    )
    const priorFromSuggestions: PlannedSlot[] = []
    for (const [sk, recipeId] of suggestions) {
      const [dStr, sl] = sk.split(':')
      const d = Number(dStr)
      const slSlot = sl as MealSlot
      if (d < dayOffset || (d === dayOffset && slSlot === 'almoco' && slot === 'jantar')) {
        priorFromSuggestions.push({
          dayOffset: d,
          slot: slSlot,
          recipeId,
          source: 'accepted',
        })
      }
    }

    const running = runningFromSlots([...prior, ...priorFromSuggestions], recipeById)
    const mealsBefore = prior.length + priorFromSuggestions.length
    const mealIndex = mealsBefore + 1
    const cumulativeExpected: Nutrition = {
      calories: dailyTargets.calories * MEAL_SHARE * mealIndex,
      protein: dailyTargets.protein * MEAL_SHARE * mealIndex,
      carbs: dailyTargets.carbs * MEAL_SHARE * mealIndex,
      fat: dailyTargets.fat * MEAL_SHARE * mealIndex,
    }
    const runningNutrition: Nutrition = {
      calories: running.calories,
      protein: running.protein,
      carbs: running.carbs,
      fat: running.fat,
    }

    const denied = new Set(deniedByKey[key] ?? [])
    const taken = new Set<number>([...decidedIds, ...suggestions.values()])

    const candidates = pool
      .filter((r) => {
        if (taken.has(r.id) || denied.has(r.id)) return false
        const origin = resolveMealOrigin(parseDescription(r.description ?? '').origin)
        return origin === slotOrigin
      })
      .map((recipe) => {
        const parsed = parseDescription(recipe.description ?? '')
        let score = scoreRecipe(recipe, ctx, taken, preference, priceAnchor)
        if (parsed.nutrition) {
          const nutritionWeight = preference === 'balanced' ? 1 : 0.55
          score +=
            nutritionScore(parsed.nutrition, runningNutrition, cumulativeExpected, dailyTargets) *
            nutritionWeight
        } else {
          score -= 4
        }
        return { recipe, score }
      })
      .sort((a, b) => b.score - a.score)

    const best = candidates[0]
    if (best) suggestions.set(key, best.recipe.id)
  }

  return suggestions
}
