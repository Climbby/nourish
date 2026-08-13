import { profileScopedKey } from './householdProfiles'
import { isPartRole, type PartRole } from './mealRole'

const LEGACY_KEY = 'nourish-part-habits'

export type PartHabits = Partial<Record<PartRole, number>>

/**
 * The last recipe used for each part of a meal, per profile.
 *
 * Sopa, sobremesa and bebida are habits far more than decisions — the same
 * water, the same piece of fruit, day after day. Remembering the last one lets
 * the empty chip offer it directly, so filling a whole meal stays one tap per
 * part instead of a trip through the picker.
 *
 * Unlike `planOriginsMemory`, this has no daily reset: a habit that resets
 * every midnight is not a habit.
 */
export function loadPartHabits(): PartHabits {
  try {
    const raw = localStorage.getItem(profileScopedKey(LEGACY_KEY))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}

    const out: PartHabits = {}
    for (const [role, recipeId] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isPartRole(role)) continue
      if (typeof recipeId !== 'number' || !Number.isFinite(recipeId)) continue
      out[role] = recipeId
    }
    return out
  } catch {
    return {}
  }
}

export function savePartHabits(habits: PartHabits): void {
  try {
    localStorage.setItem(profileScopedKey(LEGACY_KEY), JSON.stringify(habits))
  } catch {
    /* ignore */
  }
}

/** Record the recipe just used for a role, and return the updated habits. */
export function rememberPartHabit(role: PartRole, recipeId: number): PartHabits {
  const next = { ...loadPartHabits(), [role]: recipeId }
  savePartHabits(next)
  return next
}

/**
 * The habitual recipe for a role, but only while it still exists.
 *
 * A deleted recipe would otherwise leave a chip that fills the slot with a
 * dangling id.
 */
export function habitualForRole(
  habits: PartHabits,
  role: PartRole,
  existingIds: Set<number>
): number | null {
  const recipeId = habits[role]
  if (recipeId == null || !existingIds.has(recipeId)) return null
  return recipeId
}
