/**
 * Turns a Despensa product into a one-ingredient recipe, so a drink or a piece
 * of fruit can fill a plan slot without a second kind of entity in the plan.
 *
 * The recipe is named *exactly* after the product on purpose:
 * `makeProductMacroLookup` matches names exactly (accent- and case-insensitive)
 * and is deliberately non-fuzzy, so copying the name verbatim is what makes the
 * macros derive on the first try.
 */

import { grocy } from '../api/grocy'
import type { Product, Recipe } from '../types/grocy'
import { buildDescription } from './buildDescription'
import { CATEGORY_FOR_ROLE, type PartRole } from './mealRole'

/** A prato is never a single pantry product — it goes through the full form. */
export type PartRecipeRole = Exclude<PartRole, 'prato'>

export function isPartRecipeRole(role: PartRole): role is PartRecipeRole {
  return role !== 'prato'
}

/**
 * Serving size prefilled per role, in g or ml.
 *
 * A real number here is what makes the macros mean something — without it every
 * derived total would be zero.
 */
export const DEFAULT_GRAMS_FOR_ROLE: Record<PartRecipeRole, number> = {
  sopa: 300,
  sobremesa: 150,
  bebida: 250,
}

export const GRAMS_UNIT_FOR_ROLE: Record<PartRecipeRole, string> = {
  sopa: 'ml',
  sobremesa: 'g',
  bebida: 'ml',
}

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * The description of a minimal recipe: one ingredient, the serving size, and
 * the category that gives it its role. Price is left blank — deriving €/portion
 * from €/kg is possible but out of scope, so it gets edited by hand like any
 * other recipe.
 */
export function buildPartRecipeDescription(
  productName: string,
  role: PartRecipeRole,
  grams: number
): string {
  return buildDescription({
    ingredientRows: [
      { id: 0, name: productName.trim(), price: '', grams: grams > 0 ? String(grams) : '' },
    ],
    steps: '',
    nutrition: { calories: '', protein: '', carbs: '', fat: '' },
    priceOverride: '',
    autoTotal: 0,
    category: CATEGORY_FOR_ROLE[role],
    origin: 'supermercado',
  })
}

/**
 * Despensa products that have no recipe of this role yet.
 *
 * A product already turned into a recipe belongs in "Já usadas", not in the
 * list that would create a duplicate.
 */
export function despensaCandidates(
  products: Product[],
  recipes: Recipe[]
): Product[] {
  const taken = new Set(recipes.map((r) => normalize(r.name)))
  return products
    .filter((p) => !taken.has(normalize(p.name)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
}

/** Create the recipe and return it, ready to drop straight into a slot. */
export async function createPartRecipe(
  product: Product,
  role: PartRecipeRole,
  grams: number
): Promise<Recipe> {
  const name = product.name.trim()
  const description = buildPartRecipeDescription(name, role, grams)
  const { created_object_id } = await grocy.createRecipe({
    name,
    description,
    base_servings: 1,
    desired_servings: 1,
    not_check_shoppinglist: 0,
  })

  return {
    // Grocy hands the new id back as a string on some builds, and the plan keys
    // slots by number — a string id would never match `recipeById`.
    id: Number(created_object_id),
    name,
    description,
    base_servings: 1,
    desired_servings: 1,
    not_check_shoppinglist: 0,
    picture_file_name: null,
    type: 'normal',
  }
}
