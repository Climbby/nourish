import { describe, expect, it } from 'vitest'
import { isRestaurantMeal, resolveMealOrigin } from './mealOrigin'

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
