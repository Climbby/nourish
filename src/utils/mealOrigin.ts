export type MealOrigin = 'supermercado' | 'restaurante'

export const MEAL_ORIGINS: { key: MealOrigin; label: string }[] = [
  { key: 'supermercado', label: 'Casa' },
  { key: 'restaurante', label: 'Fora' },
]

export function isMealOrigin(value: string | null | undefined): value is MealOrigin {
  return value === 'supermercado' || value === 'restaurante'
}

/** Missing/legacy meals default to supermarket (home cooking). */
export function resolveMealOrigin(raw: string | null | undefined): MealOrigin {
  return isMealOrigin(raw) ? raw : 'supermercado'
}

export function mealOriginLabel(origin: MealOrigin): string {
  return MEAL_ORIGINS.find((o) => o.key === origin)?.label ?? origin
}

export function isRestaurantMeal(origin: string | null | undefined): boolean {
  return resolveMealOrigin(origin) === 'restaurante'
}
