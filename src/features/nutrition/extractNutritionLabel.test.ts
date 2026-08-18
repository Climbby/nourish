import { describe, expect, it } from 'vitest'
import { isEmptyLabel, normalizeNutritionLabel } from './extractNutritionLabel'

describe('normalizeNutritionLabel', () => {
  it('reads a well-formed label', () => {
    const result = normalizeNutritionLabel({
      calories: 420,
      protein: 8.5,
      carbs: 62.1,
      fat: 14.2,
      fibre: 3.4,
      per: '100g',
    })
    expect(result.macros).toEqual({
      calories: 420,
      protein: 8.5,
      carbs: 62.1,
      fat: 14.2,
      fibre: 3.4,
    })
    expect(result.per).toBe('100g')
    expect(result.convertedFromKj).toBe(false)
  })

  it('converts an energy value that is really kJ', () => {
    // 1757 kJ ≈ 420 kcal — the classic mistake when both columns are printed.
    const result = normalizeNutritionLabel({ calories: 1757, protein: 8, carbs: 62, fat: 14 })
    expect(result.macros.calories).toBe(420)
    expect(result.convertedFromKj).toBe(true)
  })

  it('leaves a plausible kcal value alone at the boundary', () => {
    const result = normalizeNutritionLabel({ calories: 900, protein: 0, carbs: 0, fat: 100 })
    expect(result.macros.calories).toBe(900)
    expect(result.convertedFromKj).toBe(false)
  })

  it('flags values read from the per-portion column', () => {
    expect(normalizeNutritionLabel({ calories: 150, per: 'porcao' }).per).toBe('porcao')
    expect(normalizeNutritionLabel({ calories: 150 }).per).toBe('desconhecido')
    expect(normalizeNutritionLabel({ calories: 150, per: '100ml' }).per).toBe('100g')
  })

  it('accepts comma decimals and rejects nonsense', () => {
    const result = normalizeNutritionLabel({
      calories: '380',
      protein: '12,5',
      carbs: null,
      fat: -3,
      fibre: 'n/a',
    })
    expect(result.macros).toEqual({
      calories: 380,
      protein: 12.5,
      carbs: 0,
      fat: 0,
      fibre: 0,
    })
  })

  it('survives a completely malformed reply', () => {
    const result = normalizeNutritionLabel(null)
    expect(isEmptyLabel(result)).toBe(true)
    expect(result.macros.calories).toBe(0)
  })

  it('does not treat a partially-filled label as empty', () => {
    expect(isEmptyLabel(normalizeNutritionLabel({ protein: 20 }))).toBe(false)
  })

  it('reads pack net weight and ignores junk', () => {
    expect(normalizeNutritionLabel({ calories: 18, netGrams: 185 }).netGrams).toBe(185)
    expect(normalizeNutritionLabel({ calories: 18, net_grams: 250 }).netGrams).toBe(250)
    expect(normalizeNutritionLabel({ calories: 18, netGrams: 2 }).netGrams).toBeNull()
    expect(normalizeNutritionLabel({ calories: 18, netGrams: null }).netGrams).toBeNull()
  })
})
