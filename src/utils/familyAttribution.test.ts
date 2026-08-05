import { describe, expect, it } from 'vitest'
import {
  encodeMealLogNote,
  isMealLogUnattributed,
  mealLogCountsTowardStats,
  parseMealLogNote,
} from './mealLogAttribution'
import {
  isVisitVisibleToProfile,
  visitAttributionMap,
  visitCountsTowardSpend,
} from './visitAttributions'

describe('mealLogAttribution', () => {
  it('encodes and parses owner/share', () => {
    const note = encodeMealLogNote({ owner: 'francisco', share: false })
    expect(parseMealLogNote(note)).toEqual({ owner: 'francisco', share: false })
  })

  it('treats empty note as unattributed', () => {
    expect(isMealLogUnattributed('')).toBe(true)
    expect(isMealLogUnattributed(null)).toBe(true)
  })

  it('counts only owned or shared meals toward stats', () => {
    const mine = encodeMealLogNote({ owner: 'francisco', share: false })
    const shared = encodeMealLogNote({ owner: 'pai', share: true })
    const other = encodeMealLogNote({ owner: 'pai', share: false })
    expect(mealLogCountsTowardStats(mine, 'francisco')).toBe(true)
    expect(mealLogCountsTowardStats(shared, 'francisco')).toBe(true)
    expect(mealLogCountsTowardStats(other, 'francisco')).toBe(false)
    expect(mealLogCountsTowardStats('', 'francisco')).toBe(false)
  })
})

describe('visitAttributions visibility', () => {
  const map = visitAttributionMap([
    { visit_entered_at: 'a', owner_profile_id: 'francisco', share_with_family: false },
    { visit_entered_at: 'b', owner_profile_id: 'pai', share_with_family: true },
    { visit_entered_at: 'c', owner_profile_id: 'pai', share_with_family: false },
  ])

  it('shows mine, shared, and unattributed', () => {
    expect(isVisitVisibleToProfile('a', 'francisco', map)).toBe(true)
    expect(isVisitVisibleToProfile('b', 'francisco', map)).toBe(true)
    expect(isVisitVisibleToProfile('c', 'francisco', map)).toBe(false)
    expect(isVisitVisibleToProfile('unclaimed', 'francisco', map)).toBe(true)
  })

  it('excludes unattributed from spend totals', () => {
    expect(visitCountsTowardSpend('a', 'francisco', map)).toBe(true)
    expect(visitCountsTowardSpend('b', 'francisco', map)).toBe(true)
    expect(visitCountsTowardSpend('unclaimed', 'francisco', map)).toBe(false)
  })
})
