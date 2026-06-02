import { describe, expect, it } from 'vitest'
import { aggregateMealStats, filterMealPlanByPeriod, macroGaps } from './mealStats'
import { DEFAULT_TARGETS } from '../hooks/useNutritionTargets'
import type { MealPlanEntry, Recipe } from '../types/grocy'

const recipe: Recipe = {
  id: 1,
  name: 'Atum',
  description:
    '[Nutricao]\ncalories:450\nprotein:30\ncarbs:50\nfat:12\n\n[Preco]\n3.50',
  base_servings: 1,
  desired_servings: 1,
  not_check_shoppinglist: 0,
  picture_file_name: null,
  type: 'normal',
}

describe('mealStats', () => {
  it('aggregates nutrition and spend per logged meal', () => {
    const entries: MealPlanEntry[] = [
      { id: 1, day: '2026-06-01', recipe_id: 1, note: '' },
      { id: 2, day: '2026-06-02', recipe_id: 1, note: '' },
    ]
    const totals = aggregateMealStats(entries, { 1: recipe })
    expect(totals.calories).toBe(900)
    expect(totals.protein).toBe(60)
    expect(totals.spend).toBe(7)
    expect(totals.mealsLogged).toBe(2)
    expect(totals.daysWithMeals).toBe(2)
  })

  it('filters entries by 7-day window', () => {
    const now = new Date('2026-06-10T12:00:00')
    const entries: MealPlanEntry[] = [
      { id: 1, day: '2026-06-08', recipe_id: 1, note: '' },
      { id: 2, day: '2026-06-01', recipe_id: 1, note: '' },
    ]
    const filtered = filterMealPlanByPeriod(entries, '7d', now)
    expect(filtered.map((e) => e.id)).toEqual([1])
  })

  it('ranks macro gaps descending by shortfall', () => {
    const totals = aggregateMealStats(
      [{ id: 1, day: '2026-06-01', recipe_id: 1, note: '' }],
      { 1: recipe }
    )
    const gaps = macroGaps(totals, DEFAULT_TARGETS, 7)
    expect(gaps[0].gap).toBeGreaterThanOrEqual(gaps[1].gap)
    expect(gaps.every((g) => g.gap > 0)).toBe(true)
  })
})
