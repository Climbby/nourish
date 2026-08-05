import type { MealOrigin } from './mealOrigin'
import { profileScopedKey } from './householdProfiles'

const LEGACY_KEY = 'nourish-plan-origins'

type Stored = {
  date: string
  origins: Record<string, MealOrigin>
}

function todayIso(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function isMealOrigin(v: unknown): v is MealOrigin {
  return v === 'supermercado' || v === 'restaurante'
}

export function loadPlanOrigins(): Record<string, MealOrigin> {
  try {
    const raw = localStorage.getItem(profileScopedKey(LEGACY_KEY))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Stored
    if (parsed.date !== todayIso() || !parsed.origins || typeof parsed.origins !== 'object') {
      return {}
    }
    const out: Record<string, MealOrigin> = {}
    for (const [key, value] of Object.entries(parsed.origins)) {
      if (isMealOrigin(value)) out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

export function savePlanOrigins(origins: Record<string, MealOrigin>): void {
  try {
    const payload: Stored = { date: todayIso(), origins }
    localStorage.setItem(profileScopedKey(LEGACY_KEY), JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}
