import { describe, expect, it } from 'vitest'
import {
  eatOutRestaurantName,
  isRestaurantMeal,
  mealMatchesSearch,
  resolveMealOrigin,
} from './mealOrigin'

describe('mealOrigin', () => {
  it('defaults missing origin to supermercado', () => {
    expect(resolveMealOrigin(null)).toBe('supermercado')
    expect(resolveMealOrigin(undefined)).toBe('supermercado')
    expect(resolveMealOrigin('')).toBe('supermercado')
  })

  it('recognises restaurante', () => {
    expect(resolveMealOrigin('restaurante')).toBe('restaurante')
    expect(isRestaurantMeal('restaurante')).toBe(true)
    expect(isRestaurantMeal(null)).toBe(false)
  })

  it('returns restaurant name only for eat-out meals', () => {
    expect(eatOutRestaurantName('restaurante', 'Cantina do ISCTE')).toBe('Cantina do ISCTE')
    expect(eatOutRestaurantName('restaurante', '  ')).toBeNull()
    expect(eatOutRestaurantName('supermercado', 'Cantina do ISCTE')).toBeNull()
    expect(eatOutRestaurantName(null, 'Condeixa, Coimbra')).toBeNull()
  })

  it('matches search on meal name or restaurant', () => {
    expect(mealMatchesSearch('Bitoque', 'restaurante', 'Cantina do ISCTE', 'iscte')).toBe(true)
    expect(mealMatchesSearch('Bitoque', 'restaurante', 'Cantina do ISCTE', 'bito')).toBe(true)
    expect(mealMatchesSearch('Bitoque', 'restaurante', 'Cantina do ISCTE', 'condeixa')).toBe(false)
    expect(mealMatchesSearch('Esparguete', 'supermercado', null, 'espar')).toBe(true)
  })
})

describe('mealOrigin', () => {
  it('defaults missing origin to supermercado', () => {
    expect(resolveMealOrigin(null)).toBe('supermercado')
    expect(resolveMealOrigin(undefined)).toBe('supermercado')
    expect(resolveMealOrigin('')).toBe('supermercado')
  })

  it('recognises restaurante', () => {
    expect(resolveMealOrigin('restaurante')).toBe('restaurante')
    expect(isRestaurantMeal('restaurante')).toBe(true)
    expect(isRestaurantMeal(null)).toBe(false)
  })
})
