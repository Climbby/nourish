import { describe, expect, it } from 'vitest'
import {
  hasRecipePhoto,
  MEAL_LIST_PAGE_SIZE,
  sortPhotosFirst,
  splitByPhoto,
  windowItems,
} from './mealListWindow'

function item(id: number, picture: string | null) {
  return { id, picture_file_name: picture }
}

describe('hasRecipePhoto', () => {
  it('treats a filename as a photo', () => {
    expect(hasRecipePhoto(item(1, 'meal.webp'))).toBe(true)
  })

  it('treats null and empty as no photo', () => {
    expect(hasRecipePhoto(item(1, null))).toBe(false)
    expect(hasRecipePhoto(item(2, ''))).toBe(false)
  })
})

describe('sortPhotosFirst', () => {
  it('keeps relative order inside each group', () => {
    const list = [
      item(1, null),
      item(2, 'a.webp'),
      item(3, null),
      item(4, 'b.webp'),
      item(5, 'c.webp'),
    ]
    expect(sortPhotosFirst(list).map((r) => r.id)).toEqual([2, 4, 5, 1, 3])
  })

  it('does not reshuffle when every item has a photo', () => {
    const list = [item(3, 'a.webp'), item(1, 'b.webp'), item(2, 'c.webp')]
    expect(sortPhotosFirst(list).map((r) => r.id)).toEqual([3, 1, 2])
  })
})

describe('windowItems', () => {
  it('returns the first page and nothing past the end', () => {
    const list = [1, 2, 3, 4, 5]
    expect(windowItems(list, 3)).toEqual([1, 2, 3])
    expect(windowItems(list, 20)).toEqual(list)
    expect(windowItems(list, 0)).toEqual([])
  })

  it('uses a page around 15–20 meals', () => {
    expect(MEAL_LIST_PAGE_SIZE).toBeGreaterThanOrEqual(15)
    expect(MEAL_LIST_PAGE_SIZE).toBeLessThanOrEqual(20)
  })
})

describe('splitByPhoto', () => {
  it('partitions without changing order', () => {
    const list = [item(1, 'a.webp'), item(2, null), item(3, 'b.webp')]
    const { withPhoto, withoutPhoto } = splitByPhoto(list)
    expect(withPhoto.map((r) => r.id)).toEqual([1, 3])
    expect(withoutPhoto.map((r) => r.id)).toEqual([2])
  })
})
