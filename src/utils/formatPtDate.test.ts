import { describe, expect, it } from 'vitest'
import { formatPtDate } from './formatPtDate'

describe('formatPtDate', () => {
  it('formats ISO calendar days as day/month/year', () => {
    expect(formatPtDate('2026-06-26')).toMatch(/^26\/0?6\/2026$/)
  })

  it('formats timestamps without shifting the calendar day', () => {
    expect(formatPtDate('2026-08-13 09:30:00')).toMatch(/^13\/0?8\/2026$/)
  })
})
