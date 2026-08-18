import { describe, expect, it } from 'vitest'
import {
  builderObjectivesWarning,
  builderSuggestionPreference,
  builderWeekDates,
  clearMealRun,
  countFilledDays,
  countFilledSlots,
  getPick,
  isSpanHead,
  mealSpanAt,
  mergeSuggestionsIntoPicks,
  picksToPlannedSlots,
  picksToTemplateSlots,
  repeatPreviousDay,
  saveBuilderPlan,
  setMealSpan,
  setPick,
  weekSunday,
} from './planBuilder'

/** Wednesday inside a known Dom–Sáb week. */
const WED = '2026-07-22'
const SUN = '2026-07-19'
const SAT = '2026-07-25'

describe('builderWeekDates', () => {
  it('returns Sunday through Saturday containing today', () => {
    expect(weekSunday(WED)).toBe(SUN)
    expect(builderWeekDates(WED)).toEqual([
      '2026-07-19',
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
    ])
  })

  it('keeps Sunday as the week start when today is Sunday', () => {
    expect(builderWeekDates(SUN)[0]).toBe(SUN)
    expect(builderWeekDates(SUN)[6]).toBe(SAT)
  })
})

describe('setMealSpan / mealSpanAt / repeatPreviousDay', () => {
  it('places a meal across consecutive weekdays', () => {
    const picks = setMealSpan({}, 3, 'almoco', 10, 3)
    expect(getPick(picks, 3, 'almoco')).toBe(10)
    expect(getPick(picks, 4, 'almoco')).toBe(10)
    expect(getPick(picks, 5, 'almoco')).toBe(10)
    expect(getPick(picks, 6, 'almoco')).toBeNull()
    expect(mealSpanAt(picks, 3, 'almoco')).toBe(3)
  })

  it('shrinks a run and clears the trailing days', () => {
    const wide = setMealSpan({}, 3, 'jantar', 5, 4)
    const narrow = setMealSpan(wide, 3, 'jantar', 5, 1)
    expect(mealSpanAt(narrow, 3, 'jantar')).toBe(1)
    expect(getPick(narrow, 4, 'jantar')).toBeNull()
  })

  it('does not span past Saturday', () => {
    const picks = setMealSpan({}, 6, 'almoco', 1, 5)
    expect(mealSpanAt(picks, 6, 'almoco')).toBe(1)
  })

  it('marks only the first weekday as span head', () => {
    const picks = setMealSpan({}, 3, 'almoco', 7, 2)
    expect(isSpanHead(picks, 3, 'almoco')).toBe(true)
    expect(isSpanHead(picks, 4, 'almoco')).toBe(false)
  })

  it('repeats the previous weekday’s meal', () => {
    const withPrev = setPick({}, 3, 'almoco', 42)
    const next = repeatPreviousDay(withPrev, 4, 'almoco')
    expect(getPick(next, 4, 'almoco')).toBe(42)
  })

  it('repeatPreviousDay is a no-op on Sunday or when previous is empty', () => {
    expect(repeatPreviousDay({}, 0, 'almoco')).toEqual({})
    expect(repeatPreviousDay({}, 4, 'almoco')).toEqual({})
  })

  it('clearMealRun removes the whole multi-day head', () => {
    const picks = setMealSpan({}, 3, 'almoco', 3, 3)
    const cleared = clearMealRun(picks, 3, 'almoco')
    expect(getPick(cleared, 3, 'almoco')).toBeNull()
    expect(getPick(cleared, 5, 'almoco')).toBeNull()
  })
})

describe('mergeSuggestionsIntoPicks / save', () => {
  it('only fills empty slots in the Sunday week', () => {
    const picks = setPick({}, 3, 'almoco', 1)
    const suggestions = new Map<string, number>([
      [`${WED}:almoco`, 99],
      [`${WED}:jantar`, 2],
      ['2026-07-18:almoco', 3], // previous Saturday — ignore
    ])
    const merged = mergeSuggestionsIntoPicks(picks, suggestions, SUN)
    expect(getPick(merged, 3, 'almoco')).toBe(1)
    expect(getPick(merged, 3, 'jantar')).toBe(2)
    expect(getPick(merged, 6, 'almoco')).toBeNull()
  })

  it('counts filled weekday slots and builds a Sunday-anchored plan', () => {
    const picks = setMealSpan(setPick({}, 3, 'jantar', 2), 3, 'almoco', 1, 2)
    expect(countFilledSlots(picks)).toBe(3)
    expect(countFilledDays(picks)).toBe(2)

    const plan = saveBuilderPlan('Semana manual', '', ['rápido'], picks, new Date('2026-07-22T12:00:00'))
    expect(plan.name).toBe('Semana manual')
    expect(plan.weekAnchor).toBe('sunday')
    expect(plan.slots.map((s) => s.dayOffset)).toEqual([3, 3, 4])
    expect(picksToPlannedSlots(picks, SUN)).toHaveLength(3)
    expect(picksToTemplateSlots(picks).map((s) => s.dayOffset)).toEqual([3, 3, 4])
  })
})

describe('builderSuggestionPreference', () => {
  it('drops Nutritivo to Preferidos when objectivos are off', () => {
    expect(builderSuggestionPreference(false, 'balanced')).toBe('taste')
  })

  it('keeps Barato and Preferidos, and Nutritivo when honouring targets', () => {
    expect(builderSuggestionPreference(false, 'cheap')).toBe('cheap')
    expect(builderSuggestionPreference(false, 'taste')).toBe('taste')
    expect(builderSuggestionPreference(true, 'balanced')).toBe('balanced')
  })
})

describe('builderObjectivesWarning', () => {
  it('returns null when there are no gaps', () => {
    expect(builderObjectivesWarning([])).toBeNull()
  })

  it('names a single missing macro in Portuguese', () => {
    expect(builderObjectivesWarning([{ key: 'protein', have: 10, need: 100 }])).toBe(
      'A semana está abaixo em proteína. Toca para ignorar os objectivos.'
    )
  })

  it('joins several macros with e', () => {
    expect(
      builderObjectivesWarning([
        { key: 'calories', have: 1, need: 100 },
        { key: 'protein', have: 1, need: 100 },
      ])
    ).toBe('A semana está abaixo em calorias e proteína. Toca para ignorar os objectivos.')
  })
})
