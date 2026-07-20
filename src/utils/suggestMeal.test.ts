import { describe, expect, it } from 'vitest'
import {
  medianRecipePrice,
  pickMealSuggestion,
  pickWeeklySuggestions,
  scorePreference,
  scoreRecipe,
} from './suggestMeal'
import type { MealPlanEntry, Recipe } from '../types/grocy'

const base = (id: number, name: string, description: string, picture: string | null = null): Recipe => ({
  id,
  name,
  description,
  base_servings: 1,
  desired_servings: 1,
  not_check_shoppinglist: 0,
  picture_file_name: picture,
  type: 'normal',
})

describe('scoreRecipe', () => {
  it('always deprioritizes recently logged meals', () => {
    const recipes = [
      base(1, 'Recent', '[Porcoes]\n2'),
      base(2, 'Fresh', '[Porcoes]\n2'),
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
    const ctx = { favourites: new Set<number>(), mealPlan }
    expect(scoreRecipe(recipes[0], ctx, new Set(), 'balanced')).toBeLessThan(
      scoreRecipe(recipes[1], ctx, new Set(), 'balanced')
    )
  })

  it('does not boost favourites unless preference is taste', () => {
    const recipes = [
      base(1, 'Fav', '[Porcoes]\n2'),
      base(2, 'Other', '[Porcoes]\n2'),
    ]
    const ctx = { favourites: new Set([1]), mealPlan: [] as MealPlanEntry[] }
    expect(scoreRecipe(recipes[0], ctx, new Set(), 'balanced')).toBe(
      scoreRecipe(recipes[1], ctx, new Set(), 'balanced')
    )
    expect(scoreRecipe(recipes[0], ctx, new Set(), 'taste')).toBeGreaterThan(
      scoreRecipe(recipes[1], ctx, new Set(), 'taste')
    )
  })
})

describe('scorePreference', () => {
  it('cheap prefers lower priced meals', () => {
    const cheap = base(1, 'Cheap', '[Preco]\n1.00')
    const pricey = base(2, 'Pricey', '[Preco]\n5.00')
    const ctx = { favourites: new Set<number>(), mealPlan: [] }
    const anchor = 3
    expect(scorePreference(cheap, ctx, 'cheap', anchor)).toBeGreaterThan(
      scorePreference(pricey, ctx, 'cheap', anchor)
    )
  })

  it('taste prefers favourites', () => {
    const fav = base(1, 'Fav', '')
    const other = base(2, 'Other', '')
    const ctx = { favourites: new Set([1]), mealPlan: [] }
    expect(scorePreference(fav, ctx, 'taste', null)).toBeGreaterThan(
      scorePreference(other, ctx, 'taste', null)
    )
  })

  it('taste penalises often-eaten meals to avoid repeats', () => {
    const favourite = base(1, 'Fav', '')
    const otherFav = base(2, 'OtherFav', '')
    const mealPlan: MealPlanEntry[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      day: '2026-06-01',
      recipe_id: 1,
      note: '',
    }))
    const ctx = { favourites: new Set([1, 2]), mealPlan }
    expect(scorePreference(otherFav, ctx, 'taste', null)).toBeGreaterThan(
      scorePreference(favourite, ctx, 'taste', null)
    )
  })

  it('medianRecipePrice returns the middle price', () => {
    const recipes = [
      base(1, 'A', '[Preco]\n1'),
      base(2, 'B', '[Preco]\n3'),
      base(3, 'C', '[Preco]\n5'),
    ]
    expect(medianRecipePrice(recipes)).toBe(3)
  })
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
    const ctx = { recipes, favourites: new Set<number>(), mealPlan }
    expect(pickMealSuggestion(ctx, 'balanced')?.id).toBe(2)
  })

  it('cheap preference picks the lower priced meal', () => {
    const recipes = [
      base(1, 'Expensive', '[Porcoes]\n1\n\n[Preco]\n8.00\n\n[Nutricao]\ncalories:500\nprotein:30\ncarbs:40\nfat:15'),
      base(2, 'Budget', '[Porcoes]\n1\n\n[Preco]\n1.50\n\n[Nutricao]\ncalories:500\nprotein:30\ncarbs:40\nfat:15'),
    ]
    const pick = pickMealSuggestion({ recipes, favourites: new Set(), mealPlan: [] }, 'cheap')
    expect(pick?.id).toBe(2)
  })

  it('taste preference picks favourites', () => {
    const recipes = [
      base(1, 'Fav', '[Porcoes]\n1'),
      base(2, 'Other', '[Porcoes]\n1'),
    ]
    const pick = pickMealSuggestion(
      { recipes, favourites: new Set([1]), mealPlan: [] },
      'taste'
    )
    expect(pick?.id).toBe(1)
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
