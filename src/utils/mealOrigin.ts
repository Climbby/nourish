export type MealOrigin = 'supermercado' | 'restaurante'

export const MEAL_ORIGINS: { key: MealOrigin; label: string }[] = [
  { key: 'supermercado', label: 'Cozinha' },
  { key: 'restaurante', label: 'Restaurante' },
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

/** Restaurant name stored in `[Local]` — the display identity for eat-out meals. */
export function eatOutRestaurantName(
  origin: string | null | undefined,
  location: string | null | undefined
): string | null {
  if (!isRestaurantMeal(origin)) return null
  const name = location?.trim()
  return name || null
}

export function mealMatchesSearch(
  name: string,
  origin: string | null | undefined,
  location: string | null | undefined,
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (name.toLowerCase().includes(q)) return true
  const restaurant = eatOutRestaurantName(origin, location)
  return restaurant != null && restaurant.toLowerCase().includes(q)
}
