import { beforeEach, describe, expect, it, vi } from 'vitest'
import { habitualForRole, loadPartHabits, rememberPartHabit, savePartHabits } from './partHabits'

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

describe('partHabits', () => {
  it('starts empty', () => {
    expect(loadPartHabits()).toEqual({})
  })

  it('round-trips a habit per role', () => {
    rememberPartHabit('bebida', 12)
    rememberPartHabit('sobremesa', 7)
    expect(loadPartHabits()).toEqual({ bebida: 12, sobremesa: 7 })
  })

  it('keeps only the last recipe for a role', () => {
    rememberPartHabit('bebida', 12)
    rememberPartHabit('bebida', 34)
    expect(loadPartHabits().bebida).toBe(34)
  })

  it('drops unknown roles and non-numeric ids', () => {
    savePartHabits({ bebida: 12 })
    store.set(
      [...store.keys()][0],
      JSON.stringify({ bebida: 12, pequeno_almoco: 5, sopa: 'nope' })
    )
    expect(loadPartHabits()).toEqual({ bebida: 12 })
  })

  it('survives corrupt storage', () => {
    savePartHabits({ sopa: 1 })
    store.set([...store.keys()][0], '{ not json')
    expect(loadPartHabits()).toEqual({})
  })

  it('does not reset across days, unlike plan origins', () => {
    rememberPartHabit('bebida', 12)
    vi.setSystemTime(new Date('2027-01-01T10:00:00Z'))
    expect(loadPartHabits().bebida).toBe(12)
    vi.useRealTimers()
  })
})

describe('habitualForRole', () => {
  it('offers the habit while its recipe exists', () => {
    expect(habitualForRole({ bebida: 12 }, 'bebida', new Set([12, 99]))).toBe(12)
  })

  it('withholds a habit whose recipe was deleted', () => {
    expect(habitualForRole({ bebida: 12 }, 'bebida', new Set([99]))).toBeNull()
  })

  it('is null for a role never used', () => {
    expect(habitualForRole({ bebida: 12 }, 'sopa', new Set([12]))).toBeNull()
  })
})
