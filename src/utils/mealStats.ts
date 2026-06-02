import type { MealPlanEntry, Recipe } from '../types/grocy'
import type { NutritionTargets } from '../hooks/useNutritionTargets'
import { parseDescription } from './parseDescription'
import { pickMealSuggestion, type SuggestionContext } from './suggestMeal'

export type StatsPeriod = '7d' | '30d' | 'month'

export interface NutritionTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
  mealsLogged: number
  spend: number
  daysWithMeals: number
}

export interface PeriodMeta {
  label: string
  dayCount: number
  startDay: string
}

function dayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getPeriodMeta(period: StatsPeriod, now = new Date()): PeriodMeta {
  if (period === '7d') {
    const start = new Date(now)
    start.setDate(start.getDate() - 6)
    return { label: 'Últimos 7 dias', dayCount: 7, startDay: dayStr(start) }
  }
  if (period === '30d') {
    const start = new Date(now)
    start.setDate(start.getDate() - 29)
    return { label: 'Últimos 30 dias', dayCount: 30, startDay: dayStr(start) }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const dayCount = now.getDate()
  return { label: 'Este mês', dayCount, startDay: dayStr(start) }
}

export function filterMealPlanByPeriod(
  entries: MealPlanEntry[],
  period: StatsPeriod,
  now = new Date()
): MealPlanEntry[] {
  const { startDay } = getPeriodMeta(period, now)
  const endDay = dayStr(now)
  return entries.filter((e) => e.day >= startDay && e.day <= endDay)
}

export function aggregateMealStats(
  entries: MealPlanEntry[],
  recipesById: Record<number, Recipe>
): NutritionTotals {
  const totals: NutritionTotals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    mealsLogged: 0,
    spend: 0,
    daysWithMeals: 0,
  }

  const days = new Set<string>()

  for (const entry of entries) {
    const recipe = recipesById[entry.recipe_id]
    if (!recipe) continue

    totals.mealsLogged++
    days.add(entry.day)

    const parsed = parseDescription(recipe.description ?? '')
    if (parsed.nutrition) {
      totals.calories += parsed.nutrition.calories
      totals.protein += parsed.nutrition.protein
      totals.carbs += parsed.nutrition.carbs
      totals.fat += parsed.nutrition.fat
    }
    if (parsed.price !== null) totals.spend += parsed.price
  }

  totals.daysWithMeals = days.size
  return totals
}

export interface MacroGap {
  key: 'calories' | 'protein' | 'carbs' | 'fat'
  label: string
  unit: string
  actual: number
  expected: number
  gap: number
}

export function macroGaps(
  totals: NutritionTotals,
  targets: NutritionTargets,
  dayCount: number
): MacroGap[] {
  const rows: MacroGap[] = [
    {
      key: 'calories',
      label: 'Calorias',
      unit: 'kcal',
      actual: totals.calories,
      expected: targets.caloriesPerDay * dayCount,
      gap: targets.caloriesPerDay * dayCount - totals.calories,
    },
    {
      key: 'protein',
      label: 'Proteína',
      unit: 'g',
      actual: totals.protein,
      expected: targets.proteinPerDay * dayCount,
      gap: targets.proteinPerDay * dayCount - totals.protein,
    },
    {
      key: 'carbs',
      label: 'Hidratos',
      unit: 'g',
      actual: totals.carbs,
      expected: targets.carbsPerDay * dayCount,
      gap: targets.carbsPerDay * dayCount - totals.carbs,
    },
    {
      key: 'fat',
      label: 'Gordura',
      unit: 'g',
      actual: totals.fat,
      expected: targets.fatPerDay * dayCount,
      gap: targets.fatPerDay * dayCount - totals.fat,
    },
  ]
  return rows.sort((a, b) => b.gap - a.gap)
}

export const SURPLUS_THRESHOLD = 1.1

export interface MacroSurplus {
  key: MacroGap['key']
  label: string
  unit: string
  actual: number
  expected: number
  overBy: number
  percentOfExpected: number
}

export function macroSurpluses(
  totals: NutritionTotals,
  targets: NutritionTargets,
  dayCount: number,
  threshold = SURPLUS_THRESHOLD
): MacroSurplus[] {
  return macroGaps(totals, targets, dayCount)
    .filter((g) => g.expected > 0 && g.actual >= g.expected * threshold)
    .map((g) => ({
      key: g.key,
      label: g.label,
      unit: g.unit,
      actual: g.actual,
      expected: g.expected,
      overBy: g.actual - g.expected,
      percentOfExpected: Math.round((g.actual / g.expected) * 100),
    }))
    .sort((a, b) => b.percentOfExpected - a.percentOfExpected)
}

export const SURPLUS_ADVICE: Record<MacroGap['key'], string> = {
  calories: 'Estás acima das calorias — refeições mais leves ou porções menores ajudam.',
  protein: 'Proteína acima do objectivo — geralmente ok, mas não precisas de forçar mais.',
  carbs: 'Hidratos em excesso — tenta mais vegetais e menos amidos neste período.',
  fat: 'Gordura acima do objectivo — evita fritos e molhos mais gordos.',
}

export interface NutritionRecommendation {
  recipe: Recipe
  reason: string
}

const GAP_REASON: Record<MacroGap['key'], string> = {
  calories: 'calorias abaixo do teu objectivo',
  protein: 'proteína abaixo do teu objectivo',
  carbs: 'hidratos abaixo do teu objectivo',
  fat: 'gordura abaixo do teu objectivo',
}

const OVER_REASON: Record<MacroGap['key'], string> = {
  calories: 'refeição mais leve — já comeste muitas calorias',
  protein: 'equilíbrio de proteína',
  carbs: 'menos hidratos neste período',
  fat: 'menos gordura neste período',
}

function macroValue(
  key: MacroGap['key'],
  nutrition: { calories: number; protein: number; carbs: number; fat: number }
): number {
  if (key === 'calories') return nutrition.calories
  return nutrition[key]
}

export function pickNutritionRecommendation(
  ctx: SuggestionContext,
  totals: NutritionTotals,
  targets: NutritionTargets,
  dayCount: number
): NutritionRecommendation | null {
  const { recipes, favourites, mealPlan } = ctx
  if (recipes.length === 0) return null

  const gaps = macroGaps(totals, targets, dayCount)
  const surpluses = macroSurpluses(totals, targets, dayCount)
  const topGap = gaps[0]
  const topSurplus = surpluses[0]
  const focusKey =
    topSurplus && topSurplus.percentOfExpected >= 115
      ? topSurplus.key
      : topGap.gap > 0
        ? topGap.key
        : gaps[gaps.length - 1]?.key ?? 'protein'

  const base = pickMealSuggestion(ctx)
  const recent = new Set(
    mealPlan
      .filter((e) => {
        const ts = e.row_created_timestamp?.replace(' ', 'T')
        if (!ts) return false
        return Date.now() - new Date(ts).getTime() < 48 * 60 * 60 * 1000
      })
      .map((e) => e.recipe_id)
  )

  const scored = recipes.map((recipe) => {
    const parsed = parseDescription(recipe.description ?? '')
    let score = 0
    if ((parsed.portions ?? 0) > 0) score += 5
    if (favourites.has(recipe.id)) score += 2
    if (!recent.has(recipe.id)) score += 2
    if (recent.has(recipe.id)) score -= 4

    if (parsed.nutrition && topSurplus && focusKey === topSurplus.key) {
      if (focusKey === 'calories') score -= parsed.nutrition.calories / 40
      else if (focusKey === 'carbs') score -= parsed.nutrition.carbs / 15
      else if (focusKey === 'fat') score -= parsed.nutrition.fat / 10
    } else if (parsed.nutrition && topGap.gap > 0) {
      score += macroValue(focusKey, parsed.nutrition) / 40
    } else if (parsed.nutrition && topGap.gap <= 0 && focusKey === 'calories') {
      score -= parsed.nutrition.calories / 50
    }

    if (base?.id === recipe.id) score += 1
    return { recipe, score, parsed }
  })

  scored.sort((a, b) => b.score - a.score)
  const top = scored[0]
  const pick = top?.recipe ?? base
  if (!pick) return null

  const parsed = top?.parsed ?? parseDescription(pick.description ?? '')

  let reason: string
  if (topSurplus && topSurplus.percentOfExpected >= 115) {
    reason = SURPLUS_ADVICE[topSurplus.key]
  } else if (topGap.gap > 50 || (focusKey !== 'calories' && topGap.gap > 15)) {
    reason = `Neste período comeste pouca ${GAP_REASON[focusKey]} — boa opção para equilibrar.`
  } else if (topGap.gap < -100 && focusKey === 'calories') {
    reason = OVER_REASON.calories
  } else if ((parsed.portions ?? 0) > 0) {
    reason = 'Tens porções prontas no frigorífico.'
  } else if (favourites.has(pick.id)) {
    reason = 'Uma das tuas favoritas, alinhada com o que comeste ultimamente.'
  } else {
    reason = 'Boa escolha com base no teu historial e objectivos.'
  }

  return { recipe: pick, reason }
}
