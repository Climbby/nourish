import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SlotPart } from '../hooks/usePlannedMeals'
import type { Recipe } from '../types/grocy'

const logMeal = vi.fn()
const updateRecipe = vi.fn()

vi.mock('../api/grocy', () => ({
  grocy: {
    logMeal: (...args: unknown[]) => logMeal(...args),
    updateRecipe: (...args: unknown[]) => updateRecipe(...args),
  },
}))

const { logSlotConsumption } = await import('./logMealConsumption')

const store = new Map<string, string>()

beforeEach(() => {
  logMeal.mockReset().mockResolvedValue(undefined)
  updateRecipe.mockReset().mockResolvedValue(undefined)
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

function recipe(id: number, name: string, description = ''): Recipe {
  return {
    id,
    name,
    description,
    base_servings: 1,
    desired_servings: 1,
    not_check_shoppinglist: 0,
    picture_file_name: null,
    type: 'normal',
  }
}

const SOPA = recipe(1, 'Sopa de legumes')
const PRATO = recipe(2, 'Bitoque', '[Porcoes]\n3')
const BEBIDA = recipe(3, 'Água')

const parts: SlotPart[] = [
  { role: 'bebida', recipeId: 3 },
  { role: 'prato', recipeId: 2 },
  { role: 'sopa', recipeId: 1 },
]

const recipeById = new Map([SOPA, PRATO, BEBIDA].map((r) => [r.id, r]))

describe('logSlotConsumption', () => {
  it('logs every part of the meal, not just the prato', async () => {
    const result = await logSlotConsumption(parts, recipeById)
    expect(logMeal).toHaveBeenCalledTimes(3)
    expect(result.failed).toEqual([])
  })

  it('logs parts in serving order', async () => {
    await logSlotConsumption(parts, recipeById)
    const ids = logMeal.mock.calls.map((c) => (c[0] as { recipe_id: number }).recipe_id)
    expect(ids).toEqual([1, 2, 3])
  })

  it('returns the new description only for parts whose portions changed', async () => {
    const result = await logSlotConsumption(parts, recipeById)
    expect(result.updated.map((u) => u.recipeId)).toEqual([2])
    expect(result.updated[0].description).toContain('[Porcoes]\n2')
  })

  it('names the parts that failed instead of an opaque error', async () => {
    logMeal.mockImplementation((entry: { recipe_id: number }) =>
      entry.recipe_id === 3 ? Promise.reject(new Error('offline')) : Promise.resolve(undefined)
    )
    const result = await logSlotConsumption(parts, recipeById)
    expect(result.failed).toEqual([{ role: 'bebida', name: 'Água' }])
  })

  it('keeps logging the rest after one part fails', async () => {
    logMeal.mockImplementation((entry: { recipe_id: number }) =>
      entry.recipe_id === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(undefined)
    )
    const result = await logSlotConsumption(parts, recipeById)
    expect(result.failed).toHaveLength(1)
    expect(logMeal).toHaveBeenCalledTimes(3)
  })

  it('rolls the portions back when the failing part had decremented them', async () => {
    logMeal.mockImplementation((entry: { recipe_id: number }) =>
      entry.recipe_id === 2 ? Promise.reject(new Error('offline')) : Promise.resolve(undefined)
    )
    const result = await logSlotConsumption(parts, recipeById)
    expect(result.updated).toEqual([])
    expect(updateRecipe).toHaveBeenLastCalledWith(2, { description: PRATO.description })
  })

  it('skips a part whose recipe no longer exists', async () => {
    const result = await logSlotConsumption(
      [{ role: 'sobremesa', recipeId: 99 }, ...parts],
      recipeById
    )
    expect(logMeal).toHaveBeenCalledTimes(3)
    expect(result.failed).toEqual([])
  })

  it('does nothing for an empty slot', async () => {
    const result = await logSlotConsumption([], recipeById)
    expect(logMeal).not.toHaveBeenCalled()
    expect(result).toEqual({ updated: [], failed: [] })
  })
})
