import { describe, expect, it } from 'vitest'
import type { MealSlot, PlannedSlot } from '../hooks/usePlannedMeals'
import type { Recipe } from '../types/grocy'
import { DEFAULT_TARGETS } from '../hooks/useNutritionTargets'
import { addDays } from './planDates'
import {
  buildSlotSuggestions,
  daySpend,
  futureDayCount,
  planDates,
  plannedDayCount,
  slotTotals,
  sumRecipesNutrition,
  weekdayLabel,
} from './weekPlanSlots'

/** Sunday, pinned so weekday labels and offsets never drift with the clock. */
const TODAY = '2026-07-19'
const D = (offset: number) => addDays(TODAY, offset)
const key = (offset: number, slot: MealSlot) => `${D(offset)}:${slot}`

const prato = (recipeId: number) => [{ role: 'prato' as const, recipeId }]

const slot = (
  offset: number,
  mealSlot: MealSlot,
  recipeId: number | null,
  source: PlannedSlot['source'] = 'accepted'
): PlannedSlot => ({
  date: D(offset),
  slot: mealSlot,
  parts: recipeId === null ? [] : prato(recipeId),
  source,
})

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
  it('marks today, tomorrow, and yesterday', () => {
    expect(weekdayLabel(TODAY, TODAY)).toBe('Domingo (Hoje)')
    expect(weekdayLabel(D(1), TODAY)).toBe('Segunda (Amanhã)')
    expect(weekdayLabel(D(-1), TODAY)).toBe('Sábado (Ontem)')
  })

  it('names other days plainly', () => {
    expect(weekdayLabel(D(3), TODAY)).toBe('Quarta')
    expect(weekdayLabel(D(-3), TODAY)).toBe('Quinta')
  })
})

describe('futureDayCount', () => {
  it('starts at 1 with no slots', () => {
    expect(futureDayCount([], TODAY)).toBe(1)
  })

  it('unlocks next day when any slot on current day is filled', () => {
    expect(futureDayCount([slot(0, 'almoco', 1)], TODAY)).toBe(2)
  })

  it('unlocks next day when a slot is dismissed', () => {
    expect(futureDayCount([slot(0, 'almoco', null, 'dismissed')], TODAY)).toBe(2)
  })

  it('chains unlocks across days', () => {
    const slots = [slot(0, 'jantar', 1), slot(1, 'almoco', 2, 'chosen')]
    expect(futureDayCount(slots, TODAY)).toBe(3)
  })

  it('caps at 7', () => {
    const slots = Array.from({ length: 7 }, (_, i) => slot(i, 'almoco', i + 1))
    expect(futureDayCount(slots, TODAY)).toBe(7)
  })

  it('ignores past slots — yesterday does not unlock tomorrow', () => {
    expect(futureDayCount([slot(-1, 'almoco', 1)], TODAY)).toBe(1)
  })
})

describe('planDates', () => {
  it('shows only today when the plan is empty', () => {
    expect(planDates([], TODAY)).toEqual([TODAY])
  })

  it('runs newest first — open future, then today, then the record', () => {
    const slots = [slot(0, 'almoco', 1), slot(-1, 'jantar', 2), slot(-3, 'almoco', 3)]
    expect(planDates(slots, TODAY)).toEqual([D(1), D(0), D(-1), D(-3)])
  })

  it('skips empty past days rather than padding the window', () => {
    expect(planDates([slot(-5, 'almoco', 1)], TODAY)).toEqual([TODAY, D(-5)])
  })

  it('stops at the past window', () => {
    const slots = [slot(-7, 'almoco', 1), slot(-8, 'almoco', 2)]
    expect(planDates(slots, TODAY)).toEqual([TODAY, D(-7)])
  })
})

describe('plannedDayCount', () => {
  it('counts distinct upcoming days that have a prato', () => {
    const slots = [
      slot(0, 'almoco', 1),
      slot(0, 'jantar', 2),
      slot(1, 'almoco', 3),
      slot(2, 'almoco', null, 'dismissed'),
      slot(-1, 'almoco', 4),
    ]
    expect(plannedDayCount(slots, TODAY)).toBe(2)
  })

  it('does not count a slot holding only a drink', () => {
    const bebidaOnly: PlannedSlot = {
      date: TODAY,
      slot: 'almoco',
      parts: [{ role: 'bebida', recipeId: 9 }],
      source: 'chosen',
    }
    expect(plannedDayCount([bebidaOnly], TODAY)).toBe(0)
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

  const suggest = (
    decided: PlannedSlot[] = [],
    denied: Record<string, number[]> = {},
    origins: Record<string, 'supermercado' | 'restaurante'> = {},
    pool = recipes
  ) =>
    buildSlotSuggestions(
      { recipes: pool, favourites: new Set<number>(), mealPlan: [] },
      DEFAULT_TARGETS,
      decided,
      denied,
      'balanced',
      origins,
      TODAY
    )

  it('suggests almoço and jantar for today when empty', () => {
    const map = suggest()
    expect(map.has(key(0, 'almoco'))).toBe(true)
    expect(map.has(key(0, 'jantar'))).toBe(true)
    expect(map.get(key(0, 'almoco'))).not.toBe(map.get(key(0, 'jantar')))
    expect(map.get(key(0, 'almoco'))).not.toBe(5)
    expect(map.size).toBe(2)
  })

  it('respects deny exclusions for a slot', () => {
    const deniedId = suggest().get(key(0, 'almoco'))!
    const second = suggest([], { [key(0, 'almoco')]: [deniedId] })
    expect(second.get(key(0, 'almoco'))).not.toBe(deniedId)
  })

  it('does not suggest decided recipe ids', () => {
    const map = suggest([slot(0, 'almoco', 1)])
    expect(map.has(key(0, 'almoco'))).toBe(false)
    expect(map.get(key(0, 'jantar'))).not.toBe(1)
    expect(map.has(key(1, 'almoco'))).toBe(true)
  })

  it('never suggests for a past day', () => {
    const map = suggest([slot(-1, 'almoco', 1)])
    expect(map.has(key(-1, 'almoco'))).toBe(false)
    expect(map.has(key(-1, 'jantar'))).toBe(false)
    expect([...map.keys()].every((k) => k >= TODAY)).toBe(true)
  })

  it('defaults to Casa and can switch a slot to Fora', () => {
    const withOrigin = [
      base(1, 'Casa1', nutr(500, 2) + '\n\n[Origem]\nsupermercado'),
      base(2, 'Casa2', nutr(480, 3) + '\n\n[Origem]\nsupermercado'),
      base(3, 'Fora1', nutr(520, 8) + '\n\n[Origem]\nrestaurante'),
      base(4, 'Fora2', nutr(450, 9) + '\n\n[Origem]\nrestaurante'),
    ]
    const casa = suggest([], {}, {}, withOrigin)
    expect([1, 2]).toContain(casa.get(key(0, 'almoco')))
    expect([1, 2]).toContain(casa.get(key(0, 'jantar')))

    const fora = suggest([], {}, { [key(0, 'almoco')]: 'restaurante' }, withOrigin)
    expect([3, 4]).toContain(fora.get(key(0, 'almoco')))
    expect([1, 2]).toContain(fora.get(key(0, 'jantar')))
  })
})

describe('daySpend / sumRecipesNutrition', () => {
  it('sums day and week spend', () => {
    const recipes = [base(1, 'A', nutr(500, 2.5)), base(2, 'B', nutr(400, 1.25))]
    const recipeById = new Map(recipes.map((r) => [r.id, r]))
    const slots = [slot(0, 'almoco', 1), slot(0, 'jantar', 2, 'chosen')]

    expect(daySpend(TODAY, slots, recipeById)).toBeCloseTo(3.75)
    const totals = sumRecipesNutrition(recipes)
    expect(totals.spend).toBeCloseTo(3.75)
    expect(totals.mealsWithPrice).toBe(2)
  })

  it('counts every part of a slot, not just the prato', () => {
    const recipes = [base(1, 'Prato', nutr(500, 2.5)), base(2, 'Sopa', nutr(120, 0.8))]
    const recipeById = new Map(recipes.map((r) => [r.id, r]))
    const composed: PlannedSlot = {
      date: TODAY,
      slot: 'almoco',
      parts: [
        { role: 'sopa', recipeId: 2 },
        { role: 'prato', recipeId: 1 },
      ],
      source: 'chosen',
    }
    expect(daySpend(TODAY, [composed], recipeById)).toBeCloseTo(3.3)
  })

  it('ignores other days', () => {
    const recipes = [base(1, 'A', nutr(500, 2.5))]
    const recipeById = new Map(recipes.map((r) => [r.id, r]))
    expect(daySpend(TODAY, [slot(1, 'almoco', 1)], recipeById)).toBe(0)
  })
})

describe('slotTotals', () => {
  const withMacros = (id: number, cal: number, protein: number, price: number | null) =>
    base(
      id,
      `r${id}`,
      `[Nutricao]\ncalories:${cal}\nprotein:${protein}\ncarbs:0\nfat:0` +
        (price != null ? `\n\n[Preco]\n${price.toFixed(2)}` : '')
    )

  it('sums every part of the meal, not just the prato', () => {
    const totals = slotTotals([
      withMacros(1, 700, 40, 3.1),
      withMacros(2, 90, 1, 0.4),
      withMacros(3, 80, 0, null),
    ])
    expect(totals.nutrition?.calories).toBe(870)
    expect(totals.nutrition?.protein).toBe(41)
    expect(totals.price).toBeCloseTo(3.5, 2)
  })

  it('rounds away float noise from summing parts', () => {
    const totals = slotTotals([withMacros(1, 0, 0.1, null), withMacros(2, 0, 0.2, null)])
    expect(totals.nutrition?.protein).toBe(0.3)
  })

  it('reports no nutrition when no part carries any', () => {
    expect(slotTotals([base(1, 'r1', '[Categoria]\nBebida')]).nutrition).toBeNull()
  })

  it('reports no price when no part is priced', () => {
    expect(slotTotals([withMacros(1, 700, 40, null)]).price).toBeNull()
  })

  it('is empty for an empty slot', () => {
    expect(slotTotals([])).toEqual({ nutrition: null, price: null })
  })
})
