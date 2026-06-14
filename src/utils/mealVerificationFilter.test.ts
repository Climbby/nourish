import { describe, expect, it } from 'vitest'
import { mealMatchesVerificationFilters } from './mealVerificationFilter'
import type { ParsedRecipe } from './parseDescription'

function parsed(overrides: Partial<ParsedRecipe> = {}): ParsedRecipe {
  return {
    ingredients: null,
    ingredientItems: [],
    steps: null,
    nutrition: null,
    price: null,
    category: 'Completa',
    portions: null,
    verified: [],
    ...overrides,
  }
}

describe('mealMatchesVerificationFilters', () => {
  it('shows all when no filters active', () => {
    expect(mealMatchesVerificationFilters(parsed({ verified: ['preco'] }), new Set())).toBe(true)
  })

  it('matches verified price', () => {
    const active = new Set(['preco'] as const)
    expect(mealMatchesVerificationFilters(parsed({ verified: ['preco'], price: 2 }), active)).toBe(true)
    expect(mealMatchesVerificationFilters(parsed({ verified: [], price: 2 }), active)).toBe(false)
  })

  it('matches unverified meals', () => {
    const active = new Set(['unverified'] as const)
    expect(mealMatchesVerificationFilters(parsed({ price: 2, verified: [] }), active)).toBe(true)
    expect(mealMatchesVerificationFilters(parsed({ price: 2, verified: ['preco'] }), active)).toBe(false)
  })
})
