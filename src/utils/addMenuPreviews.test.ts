import { describe, expect, it, vi } from 'vitest'

vi.mock('../api/grocy', () => ({
  grocy: {
    pictureUrl: (name: string) => `/recipe/${name}`,
    productPictureUrl: (name: string) => `/product/${name}`,
    getRecipes: vi.fn(),
    getProducts: vi.fn(),
  },
}))

vi.mock('../config/grocy', () => ({
  grocyConfig: { despensaGroupId: 6, defaultLocationId: 2, defaultQuId: 2 },
}))

import { grocy } from '../api/grocy'
import { loadAddMenuPreviews } from './addMenuPreviews'
import type { Product, Recipe } from '../types/grocy'

const recipe = (id: number, category: string, pic: string | null): Recipe => ({
  id,
  name: `R${id}`,
  description: `[Categoria]\n${category}`,
  base_servings: 1,
  desired_servings: 1,
  not_check_shoppinglist: 0,
  picture_file_name: pic,
  type: 'normal',
})

const product = (id: number, group: number, pic: string | null): Product => ({
  id,
  name: `P${id}`,
  description: null,
  product_group_id: group,
  qu_id_stock: 1,
  qu_id_purchase: 1,
  picture_file_name: pic,
  calories: null,
  active: 1,
})

describe('loadAddMenuPreviews', () => {
  it('returns up to 3 recent thumbs per category', async () => {
    vi.mocked(grocy.getRecipes).mockResolvedValue([
      recipe(1, 'Completa', 'a.jpg'),
      recipe(2, 'Completa', 'b.jpg'),
      recipe(3, 'Completa', 'c.jpg'),
      recipe(4, 'Completa', 'd.jpg'),
      recipe(5, 'Ligeira', 'e.jpg'),
      recipe(6, 'Ligeira', null),
    ])
    vi.mocked(grocy.getProducts).mockResolvedValue([
      product(10, 6, 'p1.jpg'),
      product(11, 6, 'p2.jpg'),
      product(12, 99, 'other.jpg'),
    ])

    const previews = await loadAddMenuPreviews()
    expect(previews.completa).toEqual(['/recipe/d.jpg', '/recipe/c.jpg', '/recipe/b.jpg'])
    expect(previews.ligeira).toEqual(['/recipe/e.jpg'])
    expect(previews.despensa).toEqual(['/product/p2.jpg', '/product/p1.jpg'])
  })
})
