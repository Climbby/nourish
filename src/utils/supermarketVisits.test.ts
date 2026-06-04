import { describe, expect, it } from 'vitest'
import { buildSupermarketVisits, formatVisitDuration } from './supermarketVisits'

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
})

describe('formatVisitDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatVisitDuration(75, false)).toBe('1 h 15 min')
    expect(formatVisitDuration(null, true)).toBe('Ainda no super')
  })
})
