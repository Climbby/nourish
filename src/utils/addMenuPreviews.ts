import { grocy } from '../api/grocy'
import { grocyConfig } from '../config/grocy'
import { parseDescription } from './parseDescription'
import type { Product, Recipe } from '../types/grocy'

export interface AddMenuPreviews {
  completa: string[]
  ligeira: string[]
  despensa: string[]
}

const EMPTY: AddMenuPreviews = { completa: [], ligeira: [], despensa: [] }

function recipeThumbs(
  recipes: Recipe[],
  category: 'Completa' | 'Ligeira',
  limit = 3
): string[] {
  return [...recipes]
    .filter(
      (r) =>
        r.picture_file_name &&
        parseDescription(r.description ?? '').category === category
    )
    .sort((a, b) => b.id - a.id)
    .slice(0, limit)
    .map((r) => grocy.pictureUrl(r.picture_file_name!))
}

function despensaThumbs(products: Product[], limit = 3): string[] {
  const groupId = grocyConfig.despensaGroupId
  return [...products]
    .filter(
      (p) =>
        p.picture_file_name &&
        p.product_group_id === groupId &&
        p.active !== 0
    )
    .sort((a, b) => b.id - a.id)
    .slice(0, limit)
    .map((p) => grocy.productPictureUrl(p.picture_file_name!))
}

/** Load recent photo URLs per Adicionar category (newest first). First URL is used as tile background. */
export async function loadAddMenuPreviews(): Promise<AddMenuPreviews> {
  try {
    const [recipes, products] = await Promise.all([grocy.getRecipes(), grocy.getProducts()])
    return {
      completa: recipeThumbs(recipes, 'Completa'),
      ligeira: recipeThumbs(recipes, 'Ligeira'),
      despensa: despensaThumbs(products),
    }
  } catch {
    return { ...EMPTY }
  }
}
