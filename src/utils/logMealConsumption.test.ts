import { describe, expect, it } from 'vitest'
import { currentMealSlot } from './logMealConsumption'

describe('currentMealSlot', () => {
  it('returns almoco before 15:00', () => {
    expect(currentMealSlot(new Date(2026, 6, 20, 14, 59))).toBe('almoco')
    expect(currentMealSlot(new Date(2026, 6, 20, 8, 0))).toBe('almoco')
  })

  it('returns jantar from 15:00', () => {
    expect(currentMealSlot(new Date(2026, 6, 20, 15, 0))).toBe('jantar')
    expect(currentMealSlot(new Date(2026, 6, 20, 21, 0))).toBe('jantar')
  })
})
