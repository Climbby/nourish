import { describe, expect, it } from 'vitest'
import { buildSupermarketVisits, formatVisitDuration, formatVisitTimeRange, visitExitTime, visitHasExit, visitStatusLabel } from './supermarketVisits'

describe('buildSupermarketVisits', () => {
  it('pairs enter and leave with duration', () => {
    const visits = buildSupermarketVisits([
      { type: 'supermarket_enter', at: '2026-06-01T10:00:00.000Z' },
      { type: 'supermarket_leave', at: '2026-06-01T10:45:00.000Z' },
    ])
    expect(visits).toHaveLength(1)
    expect(visits[0].duration_minutes).toBe(45)
    expect(visits[0].ongoing).toBe(false)
    expect(visits[0].left_at).toBe('2026-06-01T10:45:00.000Z')
  })

  it('marks recent open visit as ongoing', () => {
    const now = new Date('2026-06-03T15:00:00.000Z').getTime()
    const visits = buildSupermarketVisits(
      [{ type: 'supermarket_enter', at: '2026-06-03T14:00:00.000Z' }],
      now
    )
    expect(visits[0].ongoing).toBe(true)
    expect(visits[0].left_at).toBeNull()
  })

  it('stops showing ongoing after max open duration without leave', () => {
    const now = new Date('2026-06-03T20:00:00.000Z').getTime()
    const visits = buildSupermarketVisits(
      [{ type: 'supermarket_enter', at: '2026-06-03T14:00:00.000Z' }],
      now
    )
    expect(visits[0].ongoing).toBe(false)
  })

  it('returns newest first', () => {
    const visits = buildSupermarketVisits([
      { type: 'supermarket_enter', at: '2026-06-01T10:00:00.000Z' },
      { type: 'supermarket_leave', at: '2026-06-01T11:00:00.000Z' },
      { type: 'supermarket_enter', at: '2026-06-02T10:00:00.000Z' },
      { type: 'supermarket_leave', at: '2026-06-02T10:30:00.000Z' },
    ])
    expect(visits[0].entered_at).toBe('2026-06-02T10:00:00.000Z')
    expect(visits[1].entered_at).toBe('2026-06-01T10:00:00.000Z')
  })

  it('carries zone from enter event onto visit', () => {
    const visits = buildSupermarketVisits([
      { type: 'supermarket_enter', at: '2026-06-01T10:00:00.000Z', zone: 'zone.auchan' },
      { type: 'supermarket_leave', at: '2026-06-01T10:45:00.000Z' },
    ])
    expect(visits[0].zone).toBe('zone.auchan')
  })

  it('ignores duplicate enter events within debounce window', () => {
    const visits = buildSupermarketVisits([
      { type: 'supermarket_enter', at: '2026-06-12T08:24:29.515Z' },
      { type: 'supermarket_enter', at: '2026-06-12T08:24:29.547Z' },
      { type: 'supermarket_leave', at: '2026-06-12T08:29:51.470Z' },
    ])
    expect(visits).toHaveLength(1)
    expect(visits[0].duration_minutes).toBe(5)
    expect(visits[0].left_at).toBe('2026-06-12T08:29:51.470Z')
  })

  it('merges historical bounce stub visits into one block', () => {
    const visits = buildSupermarketVisits([
      { type: 'supermarket_enter', at: '2026-06-10T19:39:22.798Z' },
      { type: 'supermarket_enter', at: '2026-06-10T19:39:22.866Z' },
      { type: 'supermarket_leave', at: '2026-06-10T19:46:24.965Z' },
    ])
    expect(visits).toHaveLength(1)
    expect(visits[0].duration_minutes).toBe(7)
  })

  it('ignores spurious leave bounce and uses the real exit', () => {
    const visits = buildSupermarketVisits([
      { type: 'supermarket_enter', at: '2026-06-14T17:15:31.248Z' },
      { type: 'supermarket_enter', at: '2026-06-14T17:15:31.303Z' },
      { type: 'supermarket_leave', at: '2026-06-14T17:15:31.362Z' },
      { type: 'supermarket_leave', at: '2026-06-14T17:25:31.397Z' },
    ])
    expect(visits).toHaveLength(1)
    expect(visits[0].duration_minutes).toBe(10)
    expect(visits[0].left_at).toBe('2026-06-14T17:25:31.397Z')
  })
})

describe('formatVisitDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatVisitDuration(75, false)).toBe('1 h 15 min')
    expect(formatVisitDuration(null, true)).toBe('Ainda no super')
  })
})

describe('visit status helpers', () => {
  it('treats duration without left_at as completed', () => {
    const visit = {
      entered_at: '2026-06-01T10:00:00.000Z',
      left_at: null,
      duration_minutes: 45,
      ongoing: false,
    }
    expect(visitHasExit(visit)).toBe(true)
    expect(visitStatusLabel(visit)).toBeNull()
    expect(visitExitTime(visit)).toBe('2026-06-01T10:45:00.000Z')
  })

  it('shows missing leave only for recent incomplete visits', () => {
    const recent = {
      entered_at: '2026-06-01T10:00:00.000Z',
      left_at: null,
      duration_minutes: null,
      ongoing: false,
    }
    expect(visitStatusLabel(recent, new Date('2026-06-01T12:00:00.000Z').getTime())).toBe(
      'Saída não registada'
    )

    const old = {
      entered_at: '2026-01-01T10:00:00.000Z',
      left_at: null,
      duration_minutes: null,
      ongoing: false,
    }
    expect(visitStatusLabel(old)).toBeNull()
  })

  it('closes previous visit when re-enter without leave', () => {
    const visits = buildSupermarketVisits([
      { type: 'supermarket_enter', at: '2026-06-01T10:00:00.000Z' },
      { type: 'supermarket_enter', at: '2026-06-01T11:00:00.000Z' },
      { type: 'supermarket_leave', at: '2026-06-01T11:30:00.000Z' },
    ])
    expect(visits).toHaveLength(2)
    expect(visits[0].entered_at).toBe('2026-06-01T11:00:00.000Z')
    expect(visits[0].left_at).toBe('2026-06-01T11:30:00.000Z')
    expect(visits[1].entered_at).toBe('2026-06-01T10:00:00.000Z')
    expect(visits[1].left_at).toBe('2026-06-01T11:00:00.000Z')
    expect(visitStatusLabel(visits[1])).toBeNull()
  })

  it('hides status when exit time is shown', () => {
    const visit = {
      entered_at: '2026-06-01T10:00:00.000Z',
      left_at: '2026-06-01T10:45:00.000Z',
      duration_minutes: 45,
      ongoing: false,
    }
    expect(visitStatusLabel(visit)).toBeNull()
    expect(formatVisitTimeRange(visit)).toMatch(/· 10:30 → 11:15|· \d{2}:\d{2} → \d{2}:\d{2}/)
    expect(formatVisitTimeRange(visit)).toMatch(/^(Dom|Seg|Ter|Qua|Qui|Sex|Sáb) \d+ ·/)
  })
})
