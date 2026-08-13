/**
 * The parts a meal is made of, and how they map onto `[Categoria]`.
 *
 * A Portuguese meal is sopa + prato + sobremesa + bebida, so a plan slot holds
 * up to one recipe per role rather than a single recipe.
 *
 * `[Categoria]` carries two different axes in one field, which is fine because
 * a recipe is never both at once:
 *   - `Completa` / `Ligeira` say *which meal of the day* a recipe suits
 *   - `Sopa` / `Sobremesa` / `Bebida` say *which part of a meal* it is
 *
 * `Ligeira` is breakfast and snacks — deliberately not a prato. When those
 * meals get their own slots they read from `Ligeira` along the first axis; they
 * never show up inside almoço or jantar.
 */

export type PartRole = 'sopa' | 'prato' | 'sobremesa' | 'bebida'

/** Serving order — also the order parts render in. */
export const ROLE_ORDER: PartRole[] = ['sopa', 'prato', 'sobremesa', 'bebida']

export const ROLE_LABEL: Record<PartRole, string> = {
  sopa: 'Sopa',
  prato: 'Prato',
  sobremesa: 'Sobremesa',
  bebida: 'Bebida',
}

export const ROLE_EMOJI: Record<PartRole, string> = {
  sopa: '🥣',
  prato: '🍽️',
  sobremesa: '🍎',
  bebida: '🥤',
}

/** The category stamped on a recipe created for this role. */
export const CATEGORY_FOR_ROLE: Record<PartRole, string> = {
  sopa: 'Sopa',
  prato: 'Completa',
  sobremesa: 'Sobremesa',
  bebida: 'Bebida',
}

/** Categories a role accepts when picking a recipe for it. */
export const CATEGORIES_FOR_ROLE: Record<PartRole, string[]> = {
  sopa: ['Sopa'],
  prato: ['Completa'],
  sobremesa: ['Sobremesa'],
  bebida: ['Bebida'],
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const ROLE_BY_CATEGORY: Record<string, PartRole> = {
  completa: 'prato',
  sopa: 'sopa',
  sobremesa: 'sobremesa',
  bebida: 'bebida',
}

/**
 * The role a recipe can fill, or null when it belongs to no part of a meal.
 *
 * `Ligeira` returns null on purpose: it is breakfast/snack food, not a prato.
 */
export function roleForCategory(category: string | null | undefined): PartRole | null {
  if (!category) return null
  return ROLE_BY_CATEGORY[normalize(category)] ?? null
}

export function isPartRole(value: unknown): value is PartRole {
  return typeof value === 'string' && ROLE_ORDER.includes(value as PartRole)
}
