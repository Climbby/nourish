import { describe, expect, it } from 'vitest'
import { pickBalancedWeeklySuggestions, sumWeekPlanNutrition } from './weeklyNutritionPlan'
import { DEFAULT_TARGETS } from '../hooks/useNutritionTargets'
import type { Recipe } from '../types/grocy'

const base = (id: number, name: string, description: string): Recipe => ({
  id,
  name,
  description,
  base_servings: 1,
  desired_servings: 1,
  not_check_shoppinglist: 0,
  picture_file_name: null,
  type: 'normal',
})

const highProtein = `[Nutricao]
calories:520
protein:42
carbs:45
fat:14`

const highCarbs = `[Nutricao]
calories:480
protein:12
carbs:78
fat:8`

describe('pickBalancedWeeklySuggestions', () => {
  it('returns unique meals with focus labels', () => {
    const recipes = [
      base(1, 'Frango', highProtein),
      base(2, 'Massa', highCarbs),
      base(3, 'Salada', highCarbs),
    ]
    const week = pickBalancedWeeklySuggestions(
      { recipes, favourites: new Set(), mealPlan: [] },
      DEFAULT_TARGETS,
      3
    )
    expect(week).toHaveLength(3)
    expect(new Set(week.map((d) => d.recipe.id)).size).toBe(3)
    expect(week[0].focus).toBeTruthy()
    expect(week[0].reason).toBeTruthy()
  })

  it('sums nutrition across the plan', () => {
    const recipes = [base(1, 'A', highProtein), base(2, 'B', highCarbs)]
    const week = pickBalancedWeeklySuggestions(
      { recipes, favourites: new Set(), mealPlan: [] },
      DEFAULT_TARGETS,
      2
    )
    const totals = sumWeekPlanNutrition(week)
    expect(totals.daysWithNutrition).toBe(2)
    expect(totals.protein).toBeGreaterThan(0)
  })
})
