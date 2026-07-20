import type { MealOrigin } from './mealOrigin'

export interface AtHomePresence {
  at_home: boolean
  state: string
  entity_id: string
}

/** Home → supermercado; away → restaurante. Null if unknown. */
export function originFromAtHome(atHome: boolean | null | undefined): MealOrigin | null {
  if (atHome === true) return 'supermercado'
  if (atHome === false) return 'restaurante'
  return null
}

export async function fetchAtHome(): Promise<boolean | null> {
  try {
    const res = await fetch('/nourish/at-home', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<AtHomePresence>
    if (typeof data.at_home !== 'boolean') return null
    return data.at_home
  } catch {
    return null
  }
}
