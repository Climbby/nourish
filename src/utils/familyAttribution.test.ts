import { describe, expect, it } from 'vitest'
import {
  canClaimMealLog,
  claimMealLogNote,
  encodeMealLogNote,
  isMealLogUnattributed,
  isMealLogVisibleToProfile,
  mealLogCountsTowardStats,
  mealLogOwnerLabel,
  mealLogSlot,
  parseMealLogNote,
} from './mealLogAttribution'
import {
  canClaimVisit,
  isVisitVisibleToProfile,
  visitAttributionMap,
  visitCountsTowardSpend,
  visitOwnerIds,
  visitOwnerLabel,
} from './visitAttributions'

describe('mealLogAttribution', () => {
  it('encodes owner and always shares with family', () => {
    const note = encodeMealLogNote({ owner: 'francisco', share: false })
    expect(parseMealLogNote(note)).toEqual({
      owners: ['francisco'],
      share: true,
    })
  })

  it('treats empty note as unattributed', () => {
    expect(isMealLogUnattributed('')).toBe(true)
    expect(isMealLogUnattributed(null)).toBe(true)
  })

  it('shows all meal logs to every profile', () => {
    const mine = encodeMealLogNote({ owner: 'francisco' })
    const other = encodeMealLogNote({ owner: 'pai' })
    expect(isMealLogVisibleToProfile(mine, 'francisco')).toBe(true)
    expect(isMealLogVisibleToProfile(other, 'francisco')).toBe(true)
    expect(isMealLogVisibleToProfile('', 'francisco')).toBe(true)
  })

  it('counts any attributed meal toward household stats', () => {
    const mine = encodeMealLogNote({ owner: 'francisco' })
    const other = encodeMealLogNote({ owner: 'pai' })
    expect(mealLogCountsTowardStats(mine, 'francisco')).toBe(true)
    expect(mealLogCountsTowardStats(other, 'francisco')).toBe(true)
    expect(mealLogCountsTowardStats('', 'francisco')).toBe(false)
  })

  it('upgrades second claim to Ambos and keeps slot', () => {
    const first = encodeMealLogNote({ owner: 'francisco', slot: 'almoco' })
    const both = claimMealLogNote(first, 'pai')
    expect(parseMealLogNote(both)).toEqual({
      owners: ['francisco', 'pai'],
      share: true,
    })
    expect(mealLogSlot(both)).toBe('almoco')
    expect(mealLogOwnerLabel(both, (id) => id)).toBe('Ambos comemos')
    expect(canClaimMealLog(both, 'francisco')).toBe(false)
    expect(canClaimMealLog(both, 'pai')).toBe(false)
    expect(canClaimMealLog(first, 'pai')).toBe(true)
  })

  it('reads legacy single-owner notes', () => {
    const legacy = JSON.stringify({ owner: 'pai', share: true })
    expect(parseMealLogNote(legacy)?.owners).toEqual(['pai'])
    expect(mealLogOwnerLabel(legacy, (id) => (id === 'pai' ? 'Pai' : id))).toBe('Pai')
  })
})

describe('visitAttributions visibility', () => {
  const map = visitAttributionMap([
    { visit_entered_at: 'a', owner_profile_id: 'francisco', share_with_family: false },
    { visit_entered_at: 'b', owner_profile_id: 'pai', share_with_family: true },
    {
      visit_entered_at: 'both',
      owner_profile_id: 'francisco',
      owner_profile_ids: ['francisco', 'pai'],
      share_with_family: true,
    },
    { visit_entered_at: 'c', owner_profile_id: 'pai', share_with_family: false },
  ])

  it('shows all visits to every profile', () => {
    expect(isVisitVisibleToProfile('a', 'francisco', map)).toBe(true)
    expect(isVisitVisibleToProfile('b', 'francisco', map)).toBe(true)
    expect(isVisitVisibleToProfile('c', 'francisco', map)).toBe(true)
    expect(isVisitVisibleToProfile('unclaimed', 'francisco', map)).toBe(true)
  })

  it('counts any attributed visit toward spend; excludes unattributed', () => {
    expect(visitCountsTowardSpend('a', 'francisco', map)).toBe(true)
    expect(visitCountsTowardSpend('b', 'francisco', map)).toBe(true)
    expect(visitCountsTowardSpend('c', 'francisco', map)).toBe(true)
    expect(visitCountsTowardSpend('unclaimed', 'francisco', map)).toBe(false)
  })

  it('labels dual owners as Ambos and allows claim only when not yet owner', () => {
    expect(visitOwnerIds(map.get('both'))).toEqual(['francisco', 'pai'])
    expect(visitOwnerLabel('both', map, (id) => id)).toBe('Ambos fomos ao supermercado')
    expect(visitOwnerLabel('a', map, (id) => (id === 'francisco' ? 'Francisco' : id))).toBe(
      'Francisco'
    )
    expect(canClaimVisit('a', 'pai', map)).toBe(true)
    expect(canClaimVisit('a', 'francisco', map)).toBe(false)
    expect(canClaimVisit('both', 'pai', map)).toBe(false)
    expect(canClaimVisit('unclaimed', 'pai', map)).toBe(true)
  })
})
