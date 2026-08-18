import { describe, expect, it } from 'vitest'
import {
  parseProfileTab,
  profilePathForTab,
  PROFILE_TABS,
  resumoHasContent,
  visibleProfileTabs,
} from './profileTabs'

describe('parseProfileTab', () => {
  it('defaults to Definições', () => {
    expect(parseProfileTab(null)).toBe('definicoes')
    expect(parseProfileTab(undefined)).toBe('definicoes')
    expect(parseProfileTab('')).toBe('definicoes')
    expect(parseProfileTab('definicoes')).toBe('definicoes')
  })

  it('keeps Resumo and Objectivos from the URL', () => {
    expect(parseProfileTab('resumo')).toBe('resumo')
    expect(parseProfileTab('objectivos')).toBe('objectivos')
  })

  it('maps the legacy viaturas deep-link to Objectivos', () => {
    expect(parseProfileTab('viaturas')).toBe('objectivos')
  })
})

describe('profilePathForTab', () => {
  it('omits the query on Definições', () => {
    expect(profilePathForTab('definicoes')).toBe('/profile')
    expect(profilePathForTab('objectivos')).toBe('/profile?tab=objectivos')
    expect(profilePathForTab('resumo')).toBe('/profile?tab=resumo')
  })
})

describe('visibleProfileTabs', () => {
  it('always keeps Definições and Objectivos', () => {
    expect(PROFILE_TABS.map((t) => t.key)).toEqual(['definicoes', 'objectivos', 'resumo'])
    expect(visibleProfileTabs(true).map((t) => t.label)).toEqual([
      'Definições',
      'Objectivos',
      'Resumo',
    ])
    expect(visibleProfileTabs(false).map((t) => t.key)).toEqual(['definicoes', 'objectivos'])
  })
})

describe('resumoHasContent', () => {
  const empty = {
    nutritionActive: false,
    mealsLogged: 0,
    showPrices: false,
    shoppingEur: 0,
    fuelEur: 0,
    visitCount: 0,
  }

  it('is empty with no nutrition, meals, or spend', () => {
    expect(resumoHasContent(empty)).toBe(false)
  })

  it('is empty when nutrition is on but this profile has no meals', () => {
    expect(resumoHasContent({ ...empty, nutritionActive: true })).toBe(false)
  })

  it('is empty when meals exist but nutrition is hidden and there is no spend', () => {
    expect(resumoHasContent({ ...empty, mealsLogged: 3 })).toBe(false)
  })

  it('has content when nutrient bars would render (nutrition + meals)', () => {
    expect(resumoHasContent({ ...empty, nutritionActive: true, mealsLogged: 1 })).toBe(true)
  })

  it('has content when spend cards would show real data', () => {
    expect(resumoHasContent({ ...empty, showPrices: true, shoppingEur: 12.5 })).toBe(true)
    expect(resumoHasContent({ ...empty, showPrices: true, fuelEur: 4 })).toBe(true)
    expect(resumoHasContent({ ...empty, showPrices: true, visitCount: 2 })).toBe(true)
  })

  it('ignores zero-euro spend cards when there are no visits', () => {
    expect(
      resumoHasContent({
        ...empty,
        showPrices: true,
        shoppingEur: 0,
        fuelEur: 0,
        visitCount: 0,
      })
    ).toBe(false)
  })

  it('hides spend when prices are hidden even if visits exist', () => {
    expect(resumoHasContent({ ...empty, showPrices: false, visitCount: 3, shoppingEur: 20 })).toBe(
      false
    )
  })
})
