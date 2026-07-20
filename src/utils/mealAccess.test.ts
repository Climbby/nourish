import { describe, expect, it, beforeEach, vi } from 'vitest'
import { getMealAccessOrder, mealAccessRank, splayMealAccess } from './mealAccess'

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
  })
})

describe('splayMealAccess', () => {
  it('moves eaten meal to the front like a splay', () => {
    expect(splayMealAccess(1)).toEqual([1])
    expect(splayMealAccess(2)).toEqual([2, 1])
    expect(splayMealAccess(1)).toEqual([1, 2])
    expect(getMealAccessOrder()).toEqual([1, 2])
    expect(mealAccessRank(getMealAccessOrder(), 1)).toBe(0)
    expect(mealAccessRank(getMealAccessOrder(), 3)).toBe(Number.MAX_SAFE_INTEGER)
  })
})
