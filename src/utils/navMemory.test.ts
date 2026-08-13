import { describe, expect, it, beforeEach, vi } from 'vitest'
import { getLastNavPath, rememberNavPath } from './navMemory'
import { loadPlanOrigins, savePlanOrigins } from './planOriginsMemory'

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

describe('navMemory', () => {
  it('returns fallbacks when empty', () => {
    expect(getLastNavPath('profile')).toBe('/profile')
    expect(getLastNavPath('meals')).toBe('/meals')
    expect(getLastNavPath('plan')).toBe('/plan')
  })

  it('remembers profile and meals paths with query', () => {
    rememberNavPath('profile', '/profile?tab=definicoes')
    rememberNavPath('meals', '/meals?origem=restaurante')
    expect(getLastNavPath('profile')).toBe('/profile?tab=definicoes')
    expect(getLastNavPath('meals')).toBe('/meals?origem=restaurante')
  })

  it('ignores paths outside the section', () => {
    rememberNavPath('profile', '/meals')
    expect(getLastNavPath('profile')).toBe('/profile')
  })
})

describe('planOriginsMemory', () => {
  it('round-trips origins for today', () => {
    savePlanOrigins({ '0:almoco': 'restaurante' })
    expect(loadPlanOrigins()).toEqual({ '0:almoco': 'restaurante' })
  })

  it('drops stale or invalid entries', () => {
    store.set(
      'nourish-plan-origins',
      JSON.stringify({ date: '2000-01-01', origins: { '0:almoco': 'restaurante' } })
    )
    expect(loadPlanOrigins()).toEqual({})
  })
})
