import type { Recipe } from '../types/grocy'
import { mealAccessRank } from './mealAccess'
import type { ParsedRecipe } from './parseDescription'

export type MealSortMode = 'recent' | 'oldest' | 'price-desc' | 'price-asc' | 'splay'

export const DEFAULT_MEAL_SORT: MealSortMode = 'splay'

export const MEAL_SORT_OPTIONS: { key: MealSortMode; label: string }[] = [
  { key: 'splay', label: 'Últimas comidas' },
  { key: 'recent', label: 'Mais recentes' },
  { key: 'oldest', label: 'Mais antigas' },
  { key: 'price-desc', label: 'Mais caras' },
  { key: 'price-asc', label: 'Mais baratas' },
]

function compareNullablePrice(a: number | null | undefined, b: number | null | undefined): number {
  const aMissing = a == null || a <= 0
  const bMissing = b == null || b <= 0
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1
  return a - b
}

function compareNullablePriceDesc(a: number | null | undefined, b: number | null | undefined): number {
  const aMissing = a == null || a <= 0
  const bMissing = b == null || b <= 0
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1
  return b - a
}

export function compareRecipesForSort(
  a: Recipe,
  b: Recipe,
  parsedById: Map<number, ParsedRecipe>,
  mode: MealSortMode,
  accessOrder: number[] = []
): number {
  let cmp = 0
  switch (mode) {
    case 'recent':
      cmp = b.id - a.id
      break
    case 'oldest':
      cmp = a.id - b.id
      break
    case 'splay': {
      cmp = mealAccessRank(accessOrder, a.id) - mealAccessRank(accessOrder, b.id)
      if (cmp === 0) cmp = b.id - a.id
      break
    }
    case 'price-desc': {
      const ap = parsedById.get(a.id)?.price
      const bp = parsedById.get(b.id)?.price
      cmp = compareNullablePriceDesc(ap, bp)
      break
    }
    case 'price-asc':
      cmp = compareNullablePrice(parsedById.get(a.id)?.price, parsedById.get(b.id)?.price)
      break
  }
  if (cmp !== 0) return cmp
  return a.name.localeCompare(b.name, 'pt')
}

export function sortRecipes(
  recipes: Recipe[],
  parsedById: Map<number, ParsedRecipe>,
  mode: MealSortMode,
  accessOrder: number[] = []
): Recipe[] {
  return [...recipes].sort((a, b) => compareRecipesForSort(a, b, parsedById, mode, accessOrder))
}
