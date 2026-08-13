import type { MealSlot } from '../hooks/usePlannedMeals'

export interface MealLogAttribution {
  /** One or more household profile ids (order = first claim, then co-owners). */
  owners: string[]
  share: boolean
}

const PREFIX = 'nourish:'

function uniqueOwners(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function ownersFromParsed(parsed: { owner?: unknown; owners?: unknown }): string[] {
  if (Array.isArray(parsed.owners)) {
    return uniqueOwners(parsed.owners.filter((x): x is string => typeof x === 'string'))
  }
  if (typeof parsed.owner === 'string' && parsed.owner.trim()) {
    return [parsed.owner.trim()]
  }
  return []
}

/**
 * `meal_plan` has no column for almoço vs jantar, so the note carries it
 * alongside the attribution. Owner is optional here: a profile-less log still
 * deserves to say which meal it was.
 */
export function encodeMealLogNote(attr: {
  owner?: string | null
  owners?: string[]
  /** Ignored — family always shares. Kept so callers need not change. */
  share?: boolean
  slot?: MealSlot
}): string {
  const owners = uniqueOwners(
    attr.owners?.length ? attr.owners : attr.owner ? [attr.owner] : []
  )
  const payload: Record<string, unknown> = {}
  if (owners.length > 0) {
    // Legacy single-owner field for older readers; `owners` is the source of truth.
    payload.owner = owners[0]
    payload.owners = owners
    payload.share = true
  }
  if (attr.slot) payload.slot = attr.slot
  return Object.keys(payload).length > 0 ? JSON.stringify(payload) : ''
}

/**
 * The meal an entry was logged against, when it was written with the mark.
 *
 * Read separately from the attribution on purpose: a note carrying only a slot
 * is still unattributed, and `parseMealLogNote` must keep saying so.
 */
export function mealLogSlot(note: string | null | undefined): MealSlot | null {
  if (!note || !note.trim()) return null
  const trimmed = note.trim()
  const body = trimmed.startsWith(PREFIX) ? trimmed.slice(PREFIX.length) : trimmed
  try {
    const parsed = JSON.parse(body) as { slot?: unknown }
    if (parsed.slot === 'almoco' || parsed.slot === 'jantar') return parsed.slot
  } catch {
    /* legacy free-text notes carry no slot */
  }
  return null
}

export function parseMealLogNote(note: string | null | undefined): MealLogAttribution | null {
  if (!note || !note.trim()) return null
  const trimmed = note.trim()
  const tryParse = (raw: string): MealLogAttribution | null => {
    try {
      const parsed = JSON.parse(raw) as { owner?: unknown; owners?: unknown; share?: unknown }
      const owners = ownersFromParsed(parsed)
      if (owners.length === 0) return null
      return { owners, share: Boolean(parsed.share) }
    } catch {
      return null
    }
  }
  const direct = tryParse(trimmed)
  if (direct) return direct
  if (trimmed.startsWith(PREFIX)) {
    return tryParse(trimmed.slice(PREFIX.length))
  }
  return null
}

export function isMealLogVisibleToProfile(
  _note: string | null | undefined,
  _activeProfileId: string | null
): boolean {
  // Family always shares — every profile sees attributed and unattributed logs.
  return true
}

export function mealLogCountsTowardStats(
  note: string | null | undefined,
  activeProfileId: string | null
): boolean {
  if (!activeProfileId) return true
  const attr = parseMealLogNote(note)
  // Always shared: any attributed meal counts for household stats.
  return attr != null
}

export function isMealLogUnattributed(note: string | null | undefined): boolean {
  return parseMealLogNote(note) == null
}

/** True when the active profile is not yet among the owners (claim / co-claim). */
export function canClaimMealLog(
  note: string | null | undefined,
  activeProfileId: string | null
): boolean {
  if (!activeProfileId) return false
  const attr = parseMealLogNote(note)
  if (!attr) return true
  return !attr.owners.includes(activeProfileId)
}

/** Label for History rows: single name, or Ambos when co-owned. */
export function mealLogOwnerLabel(
  note: string | null | undefined,
  nameOf: (id: string) => string | null
): string | null {
  const attr = parseMealLogNote(note)
  if (!attr || attr.owners.length === 0) return null
  if (attr.owners.length >= 2) return 'Ambos comemos'
  return nameOf(attr.owners[0])
}

/** Add `profileId` as owner (or co-owner) without dropping existing owners / slot. */
export function claimMealLogNote(
  note: string | null | undefined,
  profileId: string
): string {
  const existing = parseMealLogNote(note)
  const owners = uniqueOwners([...(existing?.owners ?? []), profileId])
  return encodeMealLogNote({
    owners,
    slot: mealLogSlot(note) ?? undefined,
  })
}
