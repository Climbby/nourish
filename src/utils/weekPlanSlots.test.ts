import { describe, expect, it } from 'vitest'
import type { PlannedSlot } from '../hooks/usePlannedMeals'
import type { Recipe } from '../types/grocy'
import { DEFAULT_TARGETS } from '../hooks/useNutritionTargets'
import {
  buildSlotSuggestions,
  daySpend,
  sumRecipesNutrition,
  visibleDayCount,
  weekdayLabel,
} from './weekPlanSlots'

const completa = (extra: string) => `${extra}\n\n[Categoria]\nCompleta`

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

const nutr = (cal: number, price?: number) =>
  completa(
    `[Nutricao]\ncalories:${cal}\nprotein:30\ncarbs:40\nfat:12` +
      (price != null ? `\n\n[Preco]\n${price.toFixed(2)}` : '')
  )

describe('weekdayLabel', () => {
  it('marks today with (Hoje)', () => {
    // Sunday 2026-07-19
    const sun = new Date(2026, 6, 19, 12)
    expect(weekdayLabel(0, sun)).toBe('Domingo (Hoje)')
    expect(weekdayLabel(1, sun)).toBe('Segunda')
  })
})

describe('visibleDayCount', () => {
  it('starts at 1 with no slots', () => {
    expect(visibleDayCount([])).toBe(1)
  })

  it('unlocks next day when any slot on current day is filled', () => {
    const slots: PlannedSlot[] = [
      { dayOffset: 0, slot: 'almoco', recipeId: 1, source: 'accepted' },
    ]
    expect(visibleDayCount(slots)).toBe(2)
  })

  it('unlocks next day when a slot is dismissed', () => {
    const slots: PlannedSlot[] = [
      { dayOffset: 0, slot: 'almoco', recipeId: null, source: 'dismissed' },
    ]
    expect(visibleDayCount(slots)).toBe(2)
  })

  it('chains unlocks across days', () => {
    const slots: PlannedSlot[] = [
      { dayOffset: 0, slot: 'jantar', recipeId: 1, source: 'accepted' },
      { dayOffset: 1, slot: 'almoco', recipeId: 2, source: 'chosen' },
    ]
    expect(visibleDayCount(slots)).toBe(3)
  })

  it('caps at 7', () => {
    const slots: PlannedSlot[] = Array.from({ length: 7 }, (_, i) => ({
      dayOffset: i,
      slot: 'almoco' as const,
      recipeId: i + 1,
      source: 'accepted' as const,
    }))
    expect(visibleDayCount(slots)).toBe(7)
  })
})

describe('buildSlotSuggestions', () => {
  const recipes = [
    base(1, 'A', nutr(500, 2)),
    base(2, 'B', nutr(480, 3)),
    base(3, 'C', nutr(520, 1.5)),
    base(4, 'D', nutr(450, 4)),
    base(5, 'Ligeira', `[Nutricao]\ncalories:200\nprotein:10\ncarbs:20\nfat:5\n\n[Categoria]\nLigeira`),
  ]

  it('suggests almoço and jantar for day 0 when empty', () => {
    const map = buildSlotSuggestions(
      { recipes, favourites: new Set(), mealPlan: [] },
      DEFAULT_TARGETS,
      [],
      {},
      'balanced'
    )
    expect(map.has('0:almoco')).toBe(true)
    expect(map.has('0:jantar')).toBe(true)
    expect(map.get('0:almoco')).not.toBe(map.get('0:jantar'))
    expect(map.get('0:almoco')).not.toBe(5)
    expect(map.size).toBe(2)
  })

  it('respects deny exclusions for a slot', () => {
    const first = buildSlotSuggestions(
      { recipes, favourites: new Set(), mealPlan: [] },
      DEFAULT_TARGETS,
      [],
      {},
      'balanced'
    )
    const deniedId = first.get('0:almoco')!
    const second = buildSlotSuggestions(
      { recipes, favourites: new Set(), mealPlan: [] },
      DEFAULT_TARGETS,
      [],
      { '0:almoco': [deniedId] },
      'balanced'
    )
    expect(second.get('0:almoco')).not.toBe(deniedId)
  })

  it('does not suggest decided recipe ids', () => {
    const decided: PlannedSlot[] = [
      { dayOffset: 0, slot: 'almoco', recipeId: 1, source: 'accepted' },
    ]
    const map = buildSlotSuggestions(
      { recipes, favourites: new Set(), mealPlan: [] },
      DEFAULT_TARGETS,
      decided,
      {},
      'balanced'
    )
    expect(map.has('0:almoco')).toBe(false)
    expect(map.get('0:jantar')).not.toBe(1)
    expect(map.has('1:almoco')).toBe(true)
  })

  it('defaults to Casa and can switch a slot to Fora', () => {
    const withOrigin = [
      base(1, 'Casa1', nutr(500, 2) + '\n\n[Origem]\nsupermercado'),
      base(2, 'Casa2', nutr(480, 3) + '\n\n[Origem]\nsupermercado'),
      base(3, 'Fora1', nutr(520, 8) + '\n\n[Origem]\nrestaurante'),
      base(4, 'Fora2', nutr(450, 9) + '\n\n[Origem]\nrestaurante'),
    ]
    const casa = buildSlotSuggestions(
      { recipes: withOrigin, favourites: new Set(), mealPlan: [] },
      DEFAULT_TARGETS,
      [],
      {},
      'balanced'
    )
    expect([1, 2]).toContain(casa.get('0:almoco'))
    expect([1, 2]).toContain(casa.get('0:jantar'))

    const fora = buildSlotSuggestions(
      { recipes: withOrigin, favourites: new Set(), mealPlan: [] },
      DEFAULT_TARGETS,
      [],
      {},
      'balanced',
      { '0:almoco': 'restaurante' }
    )
    expect([3, 4]).toContain(fora.get('0:almoco'))
    expect([1, 2]).toContain(fora.get('0:jantar'))
  })
})

describe('daySpend / sumRecipesNutrition', () => {
  it('sums day and week spend', () => {
    const recipes = [base(1, 'A', nutr(500, 2.5)), base(2, 'B', nutr(400, 1.25))]
    const recipeById = new Map(recipes.map((r) => [r.id, r]))
    const slots: PlannedSlot[] = [
      { dayOffset: 0, slot: 'almoco', recipeId: 1, source: 'accepted' },
      { dayOffset: 0, slot: 'jantar', recipeId: 2, source: 'chosen' },
    ]
    expect(daySpend(0, slots, recipeById)).toBeCloseTo(3.75)
    const totals = sumRecipesNutrition(recipes)
    expect(totals.spend).toBeCloseTo(3.75)
    expect(totals.mealsWithPrice).toBe(2)
  })
})
