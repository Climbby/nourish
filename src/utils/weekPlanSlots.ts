import { DEFAULT_TARGETS, type NutritionTargets } from '../hooks/useNutritionTargets'
import {
  slotHasMeal,
  slotRecipeIds,
  todayIsoDate,
  type MealSlot,
  type PlannedSlot,
} from '../hooks/usePlannedMeals'
import type { Recipe } from '../types/grocy'
import { resolveMealOrigin, type MealOrigin } from './mealOrigin'
import { parseDescription, type Nutrition } from './parseDescription'
import { addDays, diffDays, MAX_FUTURE_DAYS, PAST_WINDOW_DAYS } from './planDates'
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

/** Main meal ≈ half of daily targets when planning two meals/day */
const MEAL_SHARE = 0.5

export function weekdayLabel(date: string, today = todayIsoDate()): string {
  const [y, m, d] = date.split('-').map(Number)
  const name = PT_WEEKDAYS[new Date(y, m - 1, d, 12).getDay()]
  const offset = diffDays(today, date)
  if (offset === 0) return `${name} (Hoje)`
  if (offset === 1) return `${name} (Amanhã)`
  if (offset === -1) return `${name} (Ontem)`
  return name
}

/**
 * How many days forward the plan is open for.
 *
 * Today is always open; day k+1 unlocks once day k has anything at all, so the
 * week reveals itself as it gets filled rather than dumping 7 empty days.
 */
export function futureDayCount(
  slots: PlannedSlot[],
  today = todayIsoDate(),
  maxDays = MAX_FUTURE_DAYS
): number {
  let visible = 1
  for (let day = 0; day < maxDays - 1; day++) {
    const date = addDays(today, day)
    if (!slots.some((s) => s.date === date)) break
    visible = day + 2
  }
  return Math.min(maxDays, visible)
}

/**
 * Every date the plan renders, newest first: the open future on top, then
 * today, then the days already gone underneath.
 *
 * Past days only appear when they hold something. Seven empty rows below today
 * would say nothing, so the record grows on its own as meals get eaten.
 */
export function planDates(
  slots: PlannedSlot[],
  today = todayIsoDate(),
  maxFuture = MAX_FUTURE_DAYS,
  pastWindow = PAST_WINDOW_DAYS
): string[] {
  const future: string[] = []
  const count = futureDayCount(slots, today, maxFuture)
  for (let day = count - 1; day >= 0; day--) future.push(addDays(today, day))

  const past: string[] = []
  for (let day = 1; day <= pastWindow; day++) {
    const date = addDays(today, -day)
    if (slots.some((s) => s.date === date)) past.push(date)
  }

  return [...future, ...past]
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

/** Every recipe across every part of the given slots, in plan order. */
export function slotRecipes(
  slots: PlannedSlot[],
  recipeById: Map<number, Recipe>
): Recipe[] {
  const out: Recipe[] = []
  for (const slot of slots) {
    for (const id of slotRecipeIds(slot)) {
      const recipe = recipeById.get(id)
      if (recipe) out.push(recipe)
    }
  }
  return out
}

function runningFromSlots(
  decided: PlannedSlot[],
  recipeById: Map<number, Recipe>
): WeekPlanTotals {
  return sumRecipesNutrition(slotRecipes(decided, recipeById))
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

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * What a card shows for a slot: the whole meal, not just the prato.
 *
 * Rounded because summing four parts otherwise surfaces float noise like
 * 870.0000000001 kcal on the card.
 */
export function slotTotals(recipes: Recipe[]): {
  nutrition: Nutrition | null
  price: number | null
} {
  const totals = sumRecipesNutrition(recipes)
  return {
    nutrition:
      totals.daysWithNutrition > 0
        ? {
            calories: Math.round(totals.calories),
            protein: round1(totals.protein),
            carbs: round1(totals.carbs),
            fat: round1(totals.fat),
          }
        : null,
    price: totals.mealsWithPrice > 0 ? totals.spend : null,
  }
}

/** Spend for a calendar day, across every part of both slots. */
export function daySpend(
  date: string,
  slots: PlannedSlot[],
  recipeById: Map<number, Recipe>
): number {
  const onDay = slots.filter((s) => s.date === date)
  let spend = 0
  for (const recipe of slotRecipes(onDay, recipeById)) {
    const { price } = parseDescription(recipe.description ?? '')
    if (price !== null) spend += price
  }
  return spend
}

/** Days the summary bar averages over: today onward, with a prato decided. */
export function plannedDayCount(slots: PlannedSlot[], today = todayIsoDate()): number {
  const dates = new Set(
    slots.filter((s) => s.date >= today && slotHasMeal(s)).map((s) => s.date)
  )
  return dates.size
}

function completaRecipes(recipes: Recipe[]): Recipe[] {
  return recipes.filter((r) => parseDescription(r.description ?? '').category === 'Completa')
}

/**
 * Build a prato suggestion for every undecided slot from today forward.
 *
 * Only the prato is suggested — sopa, sobremesa and bebida are filled by habit
 * and manual choice, not scored. Past days never get suggestions: they are a
 * record of what was eaten, not something left to decide.
 */
export function buildSlotSuggestions(
  ctx: SuggestionContext,
  targets: NutritionTargets,
  decided: PlannedSlot[],
  deniedByKey: Record<string, number[]>,
  preference: SuggestionPreference,
  originByKey: Record<string, MealOrigin> = {},
  today = todayIsoDate(),
  maxDays = MAX_FUTURE_DAYS
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

  // Only the upcoming plan competes for recipes. Excluding the past week too
  // would exhaust a small library; repetition there is already penalised by
  // scoreRecipe via the Grocy meal_plan.
  const upcoming = decided.filter((s) => s.date >= today)
  const decidedIds = new Set(upcoming.flatMap(slotRecipeIds))

  const suggestions = new Map<string, number>()
  const visible = futureDayCount(decided, today, maxDays)

  const ordered: { date: string; slot: MealSlot }[] = []
  for (let day = 0; day < visible; day++) {
    const date = addDays(today, day)
    for (const slot of MEAL_SLOTS) ordered.push({ date, slot })
  }

  const isBefore = (
    a: { date: string; slot: MealSlot },
    b: { date: string; slot: MealSlot }
  ) => a.date < b.date || (a.date === b.date && a.slot === 'almoco' && b.slot === 'jantar')

  for (const target of ordered) {
    const { date, slot } = target
    const key = `${date}:${slot}`
    if (upcoming.some((s) => s.date === date && s.slot === slot)) continue

    const slotOrigin = originByKey[key] ?? 'supermercado'

    const prior = upcoming.filter((s) => isBefore(s, target))
    const priorFromSuggestions: PlannedSlot[] = []
    for (const [sk, recipeId] of suggestions) {
      const idx = sk.lastIndexOf(':')
      const suggested = { date: sk.slice(0, idx), slot: sk.slice(idx + 1) as MealSlot }
      if (isBefore(suggested, target)) {
        priorFromSuggestions.push({
          date: suggested.date,
          slot: suggested.slot,
          parts: [{ role: 'prato', recipeId }],
          source: 'accepted',
        })
      }
    }

    const running = runningFromSlots([...prior, ...priorFromSuggestions], recipeById)
    const mealIndex = prior.length + priorFromSuggestions.length + 1
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
