import { describe, expect, it } from 'vitest'
import type { Recipe } from '../types/grocy'
import {
  inStapleClashWindow,
  occupiedStaplesNearDate,
  recipesInStapleClashWindow,
  recipesShareStaple,
  STAPLE_CLASH_DAY_WINDOW,
  STAPLE_CLASH_PENALTY,
  stapleClashPenalty,
  stapleKeysFromRecipe,
} from './stapleClash'

const recipe = (id: number, name: string, description = ''): Recipe => ({
  id,
  name,
  description,
  base_servings: 1,
  desired_servings: 1,
  not_check_shoppinglist: 0,
  picture_file_name: null,
  type: 'normal',
})

describe('STAPLE_CLASH_DAY_WINDOW', () => {
  it('is the same calendar day and the days on either side', () => {
    expect(STAPLE_CLASH_DAY_WINDOW).toBe(1)
    expect(inStapleClashWindow('2026-07-22', '2026-07-22')).toBe(true)
    expect(inStapleClashWindow('2026-07-22', '2026-07-21')).toBe(true)
    expect(inStapleClashWindow('2026-07-22', '2026-07-23')).toBe(true)
    expect(inStapleClashWindow('2026-07-22', '2026-07-20')).toBe(false)
    expect(inStapleClashWindow('2026-07-22', '2026-07-24')).toBe(false)
  })
})

describe('recipesInStapleClashWindow', () => {
  const pasta = recipe(1, 'Esparguete à bolonhesa')
  const chicken = recipe(2, 'Frango grelhado')
  const rice = recipe(3, 'Arroz de tomate')
  const nearby = [
    { date: '2026-07-19', recipe: pasta },
    { date: '2026-07-20', recipe: chicken },
    { date: '2026-07-21', recipe: rice },
  ]

  it('keeps meals on the same day and ±1, not two days away', () => {
    const monday = recipesInStapleClashWindow(nearby, '2026-07-20')
    expect(monday.map((r) => r.id).sort()).toEqual([1, 2, 3])

    const tuesday = recipesInStapleClashWindow(nearby, '2026-07-21')
    expect(tuesday.map((r) => r.id).sort()).toEqual([2, 3])

    const sunday = recipesInStapleClashWindow(nearby, '2026-07-19')
    expect(sunday.map((r) => r.id).sort()).toEqual([1, 2])
  })

  it('unions pasta identity from Sunday onto Monday occupied keys', () => {
    const occupied = occupiedStaplesNearDate(
      [
        { date: '2026-07-19', recipe: pasta },
        { date: '2026-07-19', recipe: chicken },
      ],
      '2026-07-20'
    )
    expect(stapleClashPenalty(stapleKeysFromRecipe(recipe(9, 'Esparguete com atum')), occupied)).toBe(
      STAPLE_CLASH_PENALTY
    )
    expect(stapleClashPenalty(stapleKeysFromRecipe(rice), occupied)).toBe(0)
  })
})

describe('pasta / meat aliases', () => {
  it('treats spaghetti-family names as the same carb staple', () => {
    expect(recipesShareStaple(recipe(1, 'Esparguete à bolonhesa'), recipe(2, 'Spaghetti al pesto'))).toBe(
      true
    )
    expect(recipesShareStaple(recipe(1, 'Esparguete'), recipe(2, 'Arroz de pato'))).toBe(false)
  })
})
