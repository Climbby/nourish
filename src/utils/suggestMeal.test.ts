import { describe, expect, it } from 'vitest'
import { pickMealSuggestion, pickWeeklySuggestions } from './suggestMeal'
import type { MealPlanEntry, Recipe } from '../types/grocy'

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

describe('pickMealSuggestion', () => {
  it('prefers meals with ready portions', () => {
    const recipes = [
      base(1, 'A', ''),
      base(2, 'B', '[Porcoes]\n3'),
    ]
    const pick = pickMealSuggestion({ recipes, favourites: new Set(), mealPlan: [] })
    expect(pick?.id).toBe(2)
  })

  it('deprioritizes recently logged meals', () => {
    const recipes = [base(1, 'A', '[Porcoes]\n2'), base(2, 'B', '[Porcoes]\n2')]
    const mealPlan: MealPlanEntry[] = [
      {
        id: 1,
        day: '2026-06-02',
        recipe_id: 1,
        note: '',
        row_created_timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      },
    ]
    const pick = pickMealSuggestion({ recipes, favourites: new Set(), mealPlan })
    expect(pick?.id).toBe(2)
  })
})

describe('pickWeeklySuggestions', () => {
  it('returns unique recipes for each day', () => {
    const recipes = [
      base(1, 'A', '[Porcoes]\n2'),
      base(2, 'B', ''),
      base(3, 'C', '[Porcoes]\n1'),
    ]
    const week = pickWeeklySuggestions({ recipes, favourites: new Set(), mealPlan: [] }, 3)
    expect(week).toHaveLength(3)
    const ids = week.map((d) => d.recipe.id)
    expect(new Set(ids).size).toBe(3)
    expect(week[0].dayLabel).toBe('Hoje')
    expect(week[1].dayLabel).toBe('Amanhã')
  })

  it('stops when recipes run out', () => {
    const recipes = [base(1, 'A', ''), base(2, 'B', '')]
    const week = pickWeeklySuggestions({ recipes, favourites: new Set(), mealPlan: [] }, 7)
    expect(week).toHaveLength(2)
  })
})
