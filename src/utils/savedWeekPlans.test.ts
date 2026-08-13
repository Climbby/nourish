import { describe, expect, it } from 'vitest'
import type { PlannedSlot } from '../hooks/usePlannedMeals'
import type { Recipe } from '../types/grocy'
import {
  applicableSlots,
  clonePlan,
  parseSavedPlans,
  planFromSlots,
  removePlan,
  summarizePlan,
  upsertPlan,
} from './savedWeekPlans'

function recipe(id: number, name: string, price: number | null): Recipe {
  return {
    id,
    name,
    description: price === null ? '[Categoria]\nCompleta' : `[Preco]\n${price.toFixed(2)}`,
    base_servings: 1,
    desired_servings: 1,
    not_check_shoppinglist: 0,
    picture_file_name: null,
    type: 'normal',
  }
}

/** Sunday. Pinned so `dayOffset` never depends on the day the suite runs. */
const TODAY = '2026-07-19'
const TOMORROW = '2026-07-20'
const YESTERDAY = '2026-07-18'

const slots: PlannedSlot[] = [
  { date: TODAY, slot: 'almoco', parts: [{ role: 'prato', recipeId: 1 }], source: 'chosen' },
  { date: TODAY, slot: 'jantar', parts: [{ role: 'prato', recipeId: 2 }], source: 'accepted' },
  { date: TOMORROW, slot: 'almoco', parts: [{ role: 'prato', recipeId: 1 }], source: 'chosen' },
  { date: TOMORROW, slot: 'jantar', parts: [], source: 'dismissed' },
]

const recipes = [recipe(1, 'Massa com atum', 4.8), recipe(2, 'Canja com grão', 1.9)]

const plan = (input: PlannedSlot[] = slots) => planFromSlots('Semana', '', [], input, TODAY)

describe('planFromSlots', () => {
  it('keeps only slots that carry a meal', () => {
    const saved = planFromSlots('Semana Barata', 'A mais barata', ['barato'], slots, TODAY)
    expect(saved.slots).toHaveLength(3)
    expect(saved.slots.every((s) => s.parts.length > 0)).toBe(true)
    expect(saved.name).toBe('Semana Barata')
    expect(saved.tags).toEqual(['barato'])
  })

  it('re-anchors dates onto offsets from today', () => {
    expect(plan().slots.map((s) => s.dayOffset)).toEqual([0, 0, 1])
  })

  it('leaves the past out — a record is not a mould', () => {
    const saved = plan([
      { date: YESTERDAY, slot: 'jantar', parts: [{ role: 'prato', recipeId: 2 }], source: 'chosen' },
      ...slots,
    ])
    expect(saved.slots).toHaveLength(3)
    expect(saved.slots.every((s) => s.dayOffset >= 0)).toBe(true)
  })

  it('trims name, description, and blank tags', () => {
    const saved = planFromSlots('  Semana  ', '  nota  ', ['  rápido  ', '', '  '], slots, TODAY)
    expect(saved.name).toBe('Semana')
    expect(saved.description).toBe('nota')
    expect(saved.tags).toEqual(['rápido'])
  })

  it('does not alias the source slots', () => {
    const saved = plan()
    saved.slots[0].parts[0].recipeId = 99
    expect(slots[0].parts[0].recipeId).toBe(1)
  })
})

describe('summarizePlan', () => {
  it('counts meals, distinct pratos, and summed price', () => {
    const summary = summarizePlan(plan(), recipes)
    expect(summary.meals).toBe(3)
    expect(summary.distinctPratos).toBe(2)
    expect(summary.spend).toBe(11.5) // 4.80 + 1.90 + 4.80
    expect(summary.partsWithPrice).toBe(3)
    expect(summary.missingRecipeIds).toEqual([])
  })

  it('sums every part, but only pratos make a meal', () => {
    const summary = summarizePlan(
      plan([
        {
          date: TODAY,
          slot: 'almoco',
          parts: [
            { role: 'sopa', recipeId: 2 },
            { role: 'prato', recipeId: 1 },
          ],
          source: 'chosen',
        },
        // No prato — a drink on its own is not a meal.
        { date: TODAY, slot: 'jantar', parts: [{ role: 'bebida', recipeId: 2 }], source: 'chosen' },
      ]),
      recipes
    )
    expect(summary.meals).toBe(1)
    expect(summary.distinctPratos).toBe(1)
    expect(summary.partsWithPrice).toBe(3)
    expect(summary.spend).toBeCloseTo(8.6) // 1.90 + 4.80 + 1.90
  })

  it('reports recipes that no longer exist without double-counting', () => {
    const summary = summarizePlan(
      plan([
        { date: TODAY, slot: 'almoco', parts: [{ role: 'prato', recipeId: 99 }], source: 'chosen' },
        { date: TOMORROW, slot: 'almoco', parts: [{ role: 'prato', recipeId: 99 }], source: 'chosen' },
      ]),
      recipes
    )
    expect(summary.missingRecipeIds).toEqual([99])
    expect(summary.meals).toBe(2)
    expect(summary.spend).toBe(0)
  })

  it('handles recipes with no price', () => {
    const summary = summarizePlan(
      plan([
        { date: TODAY, slot: 'almoco', parts: [{ role: 'prato', recipeId: 3 }], source: 'chosen' },
      ]),
      [...recipes, recipe(3, 'Sopa', null)]
    )
    expect(summary.partsWithPrice).toBe(0)
    expect(summary.spend).toBe(0)
  })
})

describe('plan collection helpers', () => {
  it('adds a new plan at the front and replaces by id', () => {
    const a = planFromSlots('A', '', [], slots, TODAY)
    const b = planFromSlots('B', '', [], slots, TODAY)
    let plans = upsertPlan([], a)
    plans = upsertPlan(plans, b)
    expect(plans.map((p) => p.name)).toEqual(['B', 'A'])

    plans = upsertPlan(plans, { ...a, name: 'A editada' })
    expect(plans).toHaveLength(2)
    expect(plans.find((p) => p.id === a.id)?.name).toBe('A editada')
  })

  it('removes by id', () => {
    const a = plan()
    expect(removePlan([a], a.id)).toEqual([])
    expect(removePlan([a], 'nope')).toHaveLength(1)
  })

  it('clones under a new id and name without sharing slots', () => {
    const a = planFromSlots('A', 'desc', ['x'], slots, TODAY)
    const copy = clonePlan(a, 'A v2')
    expect(copy.id).not.toBe(a.id)
    expect(copy.name).toBe('A v2')
    expect(copy.description).toBe('desc')
    copy.slots[0].parts[0].recipeId = 99
    expect(a.slots[0].parts[0].recipeId).toBe(1)
  })

  it('falls back to a "(cópia)" name', () => {
    const a = planFromSlots('A', '', [], slots, TODAY)
    expect(clonePlan(a, '   ').name).toBe('A (cópia)')
  })
})

describe('parseSavedPlans', () => {
  it('round-trips through JSON', () => {
    const a = planFromSlots('A', 'desc', ['barato'], slots, TODAY)
    expect(parseSavedPlans(JSON.stringify([a]))).toEqual([a])
  })

  it('survives junk without throwing', () => {
    expect(parseSavedPlans(null)).toEqual([])
    expect(parseSavedPlans('not json')).toEqual([])
    expect(parseSavedPlans('{"not":"an array"}')).toEqual([])
    expect(parseSavedPlans('[null, 3, {"id":"","name":"x"}, {"id":"a"}]')).toEqual([])
  })

  it('drops malformed slots but keeps the plan', () => {
    const raw = JSON.stringify([
      {
        id: 'a',
        name: 'A',
        slots: [
          { dayOffset: 0, slot: 'almoco', parts: [{ role: 'prato', recipeId: 1 }] },
          { dayOffset: 0, slot: 'brunch', parts: [{ role: 'prato', recipeId: 2 }] },
          { dayOffset: 1, slot: 'jantar' },
          { dayOffset: 1, slot: 'almoco', parts: [{ role: 'petisco', recipeId: 3 }] },
        ],
      },
    ])
    const plans = parseSavedPlans(raw)
    expect(plans).toHaveLength(1)
    expect(plans[0].slots).toEqual([
      { dayOffset: 0, slot: 'almoco', parts: [{ role: 'prato', recipeId: 1 }] },
    ])
  })

  it('migrates legacy single-recipe slots into a prato part', () => {
    const raw = JSON.stringify([
      {
        id: 'a',
        name: 'A',
        slots: [
          { dayOffset: 0, slot: 'almoco', recipeId: 7, source: 'chosen' },
          // Dismissed slots were never worth keeping in a mould.
          { dayOffset: 1, slot: 'jantar', recipeId: null, source: 'dismissed' },
        ],
      },
    ])
    expect(parseSavedPlans(raw)[0].slots).toEqual([
      { dayOffset: 0, slot: 'almoco', parts: [{ role: 'prato', recipeId: 7 }] },
    ])
  })
})

describe('applicableSlots', () => {
  it('drops slots whose recipe was deleted', () => {
    const saved = plan([
      { date: TODAY, slot: 'almoco', parts: [{ role: 'prato', recipeId: 1 }], source: 'chosen' },
      { date: TODAY, slot: 'jantar', parts: [{ role: 'prato', recipeId: 99 }], source: 'chosen' },
    ])
    expect(applicableSlots(saved, recipes)).toEqual([
      { dayOffset: 0, slot: 'almoco', parts: [{ role: 'prato', recipeId: 1 }] },
    ])
  })

  it('filters part by part — losing the bebida keeps the prato', () => {
    const saved = plan([
      {
        date: TODAY,
        slot: 'almoco',
        parts: [
          { role: 'prato', recipeId: 1 },
          { role: 'bebida', recipeId: 99 },
        ],
        source: 'chosen',
      },
    ])
    expect(applicableSlots(saved, recipes)).toEqual([
      { dayOffset: 0, slot: 'almoco', parts: [{ role: 'prato', recipeId: 1 }] },
    ])
  })
})
