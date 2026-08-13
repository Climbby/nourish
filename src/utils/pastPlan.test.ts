import { describe, expect, it } from 'vitest'
import type { MealSlot, PlannedSlot } from '../hooks/usePlannedMeals'
import type { MealPlanEntry } from '../types/grocy'
import { encodeMealLogNote } from './mealLogAttribution'
import type { PartRole } from './mealRole'
import { buildPastSlots, entryMealSlot, pastSlotsAsPlanned } from './pastPlan'
import { addDays } from './planDates'

const TODAY = '2026-07-19'
const D = (offset: number) => addDays(TODAY, offset)

let nextId = 1

function entry(
  day: string,
  recipeId: number,
  opts: { slot?: MealSlot; written?: string } = {}
): MealPlanEntry {
  return {
    id: nextId++,
    day,
    recipe_id: recipeId,
    note: opts.slot ? encodeMealLogNote({ slot: opts.slot }) : '',
    row_created_timestamp: opts.written,
  }
}

function planned(date: string, slot: MealSlot, parts: [PartRole, number][]): PlannedSlot {
  return {
    date,
    slot,
    parts: parts.map(([role, recipeId]) => ({ role, recipeId })),
    source: 'accepted',
  }
}

/** 1 is a prato, 2 a sopa, 3 a bebida, 9 has no role at all (a Ligeira). */
const roleOf = (recipeId: number): PartRole | null =>
  ({ 1: 'prato', 2: 'sopa', 3: 'bebida', 4: 'prato' } as Record<number, PartRole>)[recipeId] ?? null

describe('entryMealSlot', () => {
  it('reads the mark the note carries', () => {
    expect(entryMealSlot(entry(D(-1), 1, { slot: 'jantar' }))).toBe('jantar')
  })

  it('falls back to the write time for entries older than the mark', () => {
    expect(entryMealSlot(entry(D(-1), 1, { written: '2026-07-18 12:30:00' }))).toBe('almoco')
    expect(entryMealSlot(entry(D(-1), 1, { written: '2026-07-18 20:05:00' }))).toBe('jantar')
  })

  it('prefers the mark over the write time', () => {
    const e = entry(D(-1), 1, { slot: 'almoco', written: '2026-07-18 21:00:00' })
    expect(entryMealSlot(e)).toBe('almoco')
  })

  it('assumes almoço when there is no evidence at all', () => {
    expect(entryMealSlot(entry(D(-1), 1))).toBe('almoco')
  })

  it('survives an unparseable timestamp', () => {
    expect(entryMealSlot(entry(D(-1), 1, { written: 'not a date' }))).toBe('almoco')
  })
})

describe('buildPastSlots', () => {
  it('renders a day that exists only in the Grocy record', () => {
    const views = buildPastSlots([], [entry(D(-2), 1, { slot: 'almoco' })], roleOf, TODAY)
    expect(views).toHaveLength(1)
    expect(views[0].parts).toEqual([{ role: 'prato', recipeId: 1 }])
    expect([...views[0].logged]).toEqual([1])
  })

  it('renders a planned day that was never logged, without a ✓', () => {
    const views = buildPastSlots([planned(D(-1), 'jantar', [['prato', 1]])], [], roleOf, TODAY)
    expect(views[0].parts).toEqual([{ role: 'prato', recipeId: 1 }])
    expect(views[0].logged.size).toBe(0)
  })

  it('marks only the parts that were actually logged', () => {
    const views = buildPastSlots(
      [planned(D(-1), 'almoco', [['prato', 1], ['sopa', 2], ['bebida', 3]])],
      [entry(D(-1), 2, { slot: 'almoco' })],
      roleOf,
      TODAY
    )
    expect(views[0].parts).toHaveLength(3)
    expect([...views[0].logged]).toEqual([2])
  })

  it('lets the record displace a plan that was not followed', () => {
    const views = buildPastSlots(
      [planned(D(-1), 'almoco', [['prato', 1]])],
      [entry(D(-1), 4, { slot: 'almoco' })],
      roleOf,
      TODAY
    )
    expect(views[0].parts).toEqual([{ role: 'prato', recipeId: 4 }])
  })

  it('keeps the earliest log when two compete for one role', () => {
    const first = entry(D(-1), 1, { slot: 'almoco' })
    const second = entry(D(-1), 4, { slot: 'almoco' })
    const views = buildPastSlots([], [second, first], roleOf, TODAY)
    expect(views[0].parts).toEqual([{ role: 'prato', recipeId: 1 }])
    expect([...views[0].logged].sort()).toEqual([1, 4])
  })

  it('records a roleless recipe as the prato — it was still the meal', () => {
    const views = buildPastSlots([], [entry(D(-1), 9, { slot: 'jantar' })], roleOf, TODAY)
    expect(views[0].parts).toEqual([{ role: 'prato', recipeId: 9 }])
  })

  it('splits entries into almoço and jantar', () => {
    const views = buildPastSlots(
      [],
      [entry(D(-1), 1, { slot: 'almoco' }), entry(D(-1), 4, { slot: 'jantar' })],
      roleOf,
      TODAY
    )
    expect(views.map((v) => v.slot)).toEqual(['almoco', 'jantar'])
  })

  it('keeps the entry id so a chip can be pulled from the record', () => {
    const logged = entry(D(-1), 1, { slot: 'almoco' })
    const views = buildPastSlots([], [logged], roleOf, TODAY)
    expect(views[0].entryIdByRecipe.get(1)).toBe(logged.id)
  })

  it('ignores today and the future — those are the plan, not the record', () => {
    const views = buildPastSlots(
      [planned(TODAY, 'almoco', [['prato', 1]]), planned(D(1), 'almoco', [['prato', 1]])],
      [entry(TODAY, 1, { slot: 'almoco' })],
      roleOf,
      TODAY
    )
    expect(views).toEqual([])
  })

  it('drops anything older than the window', () => {
    const views = buildPastSlots([], [entry(D(-8), 1, { slot: 'almoco' })], roleOf, TODAY)
    expect(views).toEqual([])
  })

  it('skips dismissed and empty planned slots', () => {
    const dismissed: PlannedSlot = {
      date: D(-1),
      slot: 'almoco',
      parts: [],
      source: 'dismissed',
    }
    expect(buildPastSlots([dismissed], [], roleOf, TODAY)).toEqual([])
  })

  it('orders newest day first, almoço before jantar', () => {
    const views = buildPastSlots(
      [],
      [
        entry(D(-3), 1, { slot: 'jantar' }),
        entry(D(-1), 1, { slot: 'jantar' }),
        entry(D(-1), 2, { slot: 'almoco' }),
      ],
      roleOf,
      TODAY
    )
    expect(views.map((v) => `${v.date}:${v.slot}`)).toEqual([
      `${D(-1)}:almoco`,
      `${D(-1)}:jantar`,
      `${D(-3)}:jantar`,
    ])
  })

  it('does not log the same recipe twice into one slot', () => {
    const views = buildPastSlots(
      [planned(D(-1), 'almoco', [['prato', 1]])],
      [entry(D(-1), 1, { slot: 'almoco' })],
      roleOf,
      TODAY
    )
    expect(views[0].parts).toEqual([{ role: 'prato', recipeId: 1 }])
  })
})

describe('pastSlotsAsPlanned', () => {
  it('shapes the merged past so the plan machinery can read it', () => {
    const views = buildPastSlots([], [entry(D(-1), 1, { slot: 'almoco' })], roleOf, TODAY)
    expect(pastSlotsAsPlanned(views)).toEqual([
      { date: D(-1), slot: 'almoco', parts: [{ role: 'prato', recipeId: 1 }], source: 'chosen' },
    ])
  })

  it('copies the parts so mutating the result cannot corrupt the view', () => {
    const views = buildPastSlots([], [entry(D(-1), 1, { slot: 'almoco' })], roleOf, TODAY)
    pastSlotsAsPlanned(views)[0].parts[0].recipeId = 99
    expect(views[0].parts[0].recipeId).toBe(1)
  })
})
