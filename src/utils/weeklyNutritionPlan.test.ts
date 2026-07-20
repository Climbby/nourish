import { describe, expect, it } from 'vitest'
import { pickBalancedWeeklySuggestions, sumWeekPlanNutrition } from './weeklyNutritionPlan'
import { DEFAULT_TARGETS } from '../hooks/useNutritionTargets'
import type { MealPlanEntry, Recipe } from '../types/grocy'

const completa = (description: string) => `${description}\n\n[Categoria]\nCompleta`

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

const highProtein = completa(`[Nutricao]
calories:520
protein:42
carbs:45
fat:14`)

const highCarbs = completa(`[Nutricao]
calories:480
protein:12
carbs:78
fat:8`)

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

  it('only includes Completa meals', () => {
    const recipes = [
      base(1, 'Completa', highProtein),
      base(2, 'Ligeira', `[Nutricao]\ncalories:300\nprotein:10\ncarbs:40\nfat:5\n\n[Categoria]\nLigeira`),
      base(3, 'Sem categoria', `[Nutricao]\ncalories:400\nprotein:20\ncarbs:50\nfat:10`),
    ]
    const week = pickBalancedWeeklySuggestions(
      { recipes, favourites: new Set(), mealPlan: [] },
      DEFAULT_TARGETS,
      3
    )
    expect(week).toHaveLength(1)
    expect(week[0].recipe.id).toBe(1)
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

  it('sums meal prices across the plan', () => {
    const recipes = [
      base(1, 'A', `${highProtein}\n\n[Preco]\n2.50`),
      base(2, 'B', `${highCarbs}\n\n[Preco]\n1.75`),
      base(3, 'C', highProtein),
    ]
    const week = pickBalancedWeeklySuggestions(
      { recipes, favourites: new Set(), mealPlan: [] },
      DEFAULT_TARGETS,
      3
    )
    const totals = sumWeekPlanNutrition(week)
    expect(totals.mealsWithPrice).toBe(2)
    expect(totals.spend).toBeCloseTo(4.25)
  })

  it('avoids recently eaten meals', () => {
    const recipes = [
      base(1, 'Recent', highProtein),
      base(2, 'Other', highProtein),
    ]
    const mealPlan: MealPlanEntry[] = [
      {
        id: 1,
        day: '2026-06-02',
        recipe_id: 1,
        note: '',
        row_created_timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      },
    ]
    const week = pickBalancedWeeklySuggestions(
      { recipes, favourites: new Set(), mealPlan },
      DEFAULT_TARGETS,
      1,
      new Date(),
      'balanced'
    )
    expect(week[0].recipe.id).toBe(2)
  })

  it('uses custom profile targets for nutrition balance', () => {
    const recipes = [
      base(1, 'Light', completa(`[Nutricao]\ncalories:200\nprotein:20\ncarbs:20\nfat:8`)),
      base(2, 'Heavy', completa(`[Nutricao]\ncalories:1100\nprotein:60\ncarbs:100\nfat:40`)),
    ]
    const highTargets = {
      caloriesPerDay: 2200,
      proteinPerDay: 160,
      carbsPerDay: 220,
      fatPerDay: 70,
    }
    const ctx = { recipes, favourites: new Set<number>(), mealPlan: [] as MealPlanEntry[] }

    const withHigh = pickBalancedWeeklySuggestions(ctx, highTargets, 1, new Date(), 'balanced')
    expect(withHigh[0].recipe.id).toBe(2)
  })

  it('cheap preference prefers lower priced meals', () => {
    const recipes = [
      base(1, 'Pricey', `${highProtein}\n\n[Preco]\n6.00`),
      base(2, 'Budget', `${highProtein}\n\n[Preco]\n1.20`),
    ]
    const week = pickBalancedWeeklySuggestions(
      { recipes, favourites: new Set(), mealPlan: [] },
      DEFAULT_TARGETS,
      1,
      new Date(),
      'cheap'
    )
    expect(week[0].recipe.id).toBe(2)
    expect(week[0].reason.toLowerCase()).toMatch(/económica|€/)
  })

  it('taste preference prefers favourites', () => {
    const recipes = [
      base(1, 'Fav', highProtein),
      base(2, 'Other', highProtein),
    ]
    const week = pickBalancedWeeklySuggestions(
      { recipes, favourites: new Set([1]), mealPlan: [] },
      DEFAULT_TARGETS,
      1,
      new Date(),
      'taste'
    )
    expect(week[0].recipe.id).toBe(1)
  })
})
