import type { ParsedRecipe } from './parseDescription'

export type VerificationFilterKey = 'preco' | 'nutricao' | 'unverified'

export function mealMatchesVerificationFilters(
  parsed: ParsedRecipe,
  active: Set<VerificationFilterKey>
): boolean {
  if (active.size === 0) return true

  const precoOk = parsed.verified.includes('preco')
  const nutricaoOk = parsed.verified.includes('nutricao')
  const hasPrice = parsed.price !== null
  const hasNutrition = parsed.nutrition != null
  const isUnverified =
    (hasPrice && !precoOk) || (hasNutrition && !nutricaoOk) || (!hasPrice && !hasNutrition)

  if (active.has('preco') && precoOk) return true
  if (active.has('nutricao') && nutricaoOk) return true
  if (active.has('unverified') && isUnverified) return true
  return false
}
