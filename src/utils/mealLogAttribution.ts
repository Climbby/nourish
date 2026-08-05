export interface MealLogAttribution {
  owner: string
  share: boolean
}

const PREFIX = 'nourish:'

export function encodeMealLogNote(attr: MealLogAttribution): string {
  return JSON.stringify({ owner: attr.owner, share: Boolean(attr.share) })
}

export function parseMealLogNote(note: string | null | undefined): MealLogAttribution | null {
  if (!note || !note.trim()) return null
  const trimmed = note.trim()
  try {
    const parsed = JSON.parse(trimmed) as { owner?: unknown; share?: unknown }
    if (typeof parsed.owner === 'string' && parsed.owner.trim()) {
      return { owner: parsed.owner.trim(), share: Boolean(parsed.share) }
    }
  } catch {
    /* legacy free-text notes — treat as unattributed */
  }
  // Tolerate accidental prefix
  if (trimmed.startsWith(PREFIX)) {
    try {
      const parsed = JSON.parse(trimmed.slice(PREFIX.length)) as { owner?: unknown; share?: unknown }
      if (typeof parsed.owner === 'string' && parsed.owner.trim()) {
        return { owner: parsed.owner.trim(), share: Boolean(parsed.share) }
      }
    } catch {
      /* ignore */
    }
  }
  return null
}

export function isMealLogVisibleToProfile(
  note: string | null | undefined,
  activeProfileId: string | null
): boolean {
  if (!activeProfileId) return true
  const attr = parseMealLogNote(note)
  if (!attr) return true // unattributed — claimable
  return attr.owner === activeProfileId || attr.share
}

export function mealLogCountsTowardStats(
  note: string | null | undefined,
  activeProfileId: string | null
): boolean {
  if (!activeProfileId) return true
  const attr = parseMealLogNote(note)
  if (!attr) return false
  return attr.owner === activeProfileId || attr.share
}

export function isMealLogUnattributed(note: string | null | undefined): boolean {
  return parseMealLogNote(note) == null
}
