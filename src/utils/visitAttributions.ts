export interface VisitAttribution {
  visit_entered_at: string
  /** First / primary owner (legacy + compact readers). */
  owner_profile_id: string
  /** All owners; when length ≥ 2 the UI shows Ambos. */
  owner_profile_ids?: string[]
  share_with_family: boolean
}

const LOCAL_KEY = 'nourish-visit-attributions'

function uniqueOwners(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const id = String(raw).trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** Normalized owner list for a visit attribution row. */
export function visitOwnerIds(attr: VisitAttribution | undefined | null): string[] {
  if (!attr) return []
  if (Array.isArray(attr.owner_profile_ids) && attr.owner_profile_ids.length > 0) {
    return uniqueOwners(attr.owner_profile_ids)
  }
  return attr.owner_profile_id ? [attr.owner_profile_id] : []
}

function normalizeAttribution(row: VisitAttribution): VisitAttribution {
  const owners = visitOwnerIds(row)
  return {
    visit_entered_at: row.visit_entered_at,
    owner_profile_id: owners[0] ?? row.owner_profile_id,
    owner_profile_ids: owners.length > 0 ? owners : undefined,
    share_with_family: true,
  }
}

function loadLocal(): VisitAttribution[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((r) => normalizeAttribution(r as VisitAttribution)) : []
  } catch {
    return []
  }
}

function saveLocal(list: VisitAttribution[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list.map(normalizeAttribution)))
}

export async function fetchVisitAttributions(): Promise<VisitAttribution[]> {
  try {
    const res = await fetch('/nourish/visit-attributions', { cache: 'no-store' })
    if (!res.ok) return loadLocal()
    const data = (await res.json()) as { attributions?: VisitAttribution[] }
    const list = Array.isArray(data.attributions)
      ? data.attributions.map(normalizeAttribution)
      : []
    saveLocal(list)
    return list
  } catch {
    return loadLocal()
  }
}

export async function upsertVisitAttribution(row: VisitAttribution): Promise<VisitAttribution[]> {
  const normalized = normalizeAttribution(row)
  const list = loadLocal().filter((a) => a.visit_entered_at !== normalized.visit_entered_at)
  list.push(normalized)
  saveLocal(list)
  try {
    const res = await fetch('/nourish/visit-attributions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    })
    if (res.ok) {
      const data = (await res.json()) as { attributions?: VisitAttribution[] }
      if (Array.isArray(data.attributions)) {
        const next = data.attributions.map(normalizeAttribution)
        saveLocal(next)
        return next
      }
    }
  } catch {
    /* local fallback */
  }
  return list
}

/**
 * Attribute a visit to `profileId`. If another profile already owns it, becomes co-owned (Ambos).
 * No-op when this profile is already an owner.
 */
export async function claimVisitAttribution(
  visitEnteredAt: string,
  profileId: string
): Promise<VisitAttribution[]> {
  const id = profileId.trim()
  if (!id) return fetchVisitAttributions()

  const list = await fetchVisitAttributions()
  const existing = list.find((a) => a.visit_entered_at === visitEnteredAt)
  const owners = visitOwnerIds(existing)
  if (owners.includes(id)) return list

  return upsertVisitAttribution({
    visit_entered_at: visitEnteredAt,
    owner_profile_id: owners[0] ?? id,
    owner_profile_ids: [...owners, id],
    share_with_family: true,
  })
}

export function visitAttributionMap(list: VisitAttribution[]): Map<string, VisitAttribution> {
  return new Map(list.map((a) => [a.visit_entered_at, normalizeAttribution(a)]))
}

/** Visible to active profile — family always shares, so all visits are shown. */
export function isVisitVisibleToProfile(
  _visitEnteredAt: string,
  _activeProfileId: string | null,
  _byVisit: Map<string, VisitAttribution>
): boolean {
  return true
}

export function isVisitOwnedBy(
  visitEnteredAt: string,
  profileId: string,
  byVisit: Map<string, VisitAttribution>
): boolean {
  return visitOwnerIds(byVisit.get(visitEnteredAt)).includes(profileId)
}

export function isVisitUnattributed(
  visitEnteredAt: string,
  byVisit: Map<string, VisitAttribution>
): boolean {
  return visitOwnerIds(byVisit.get(visitEnteredAt)).length === 0
}

/** True when active profile can still claim (unattributed or owned only by others). */
export function canClaimVisit(
  visitEnteredAt: string,
  activeProfileId: string | null,
  byVisit: Map<string, VisitAttribution>
): boolean {
  if (!activeProfileId) return false
  return !visitOwnerIds(byVisit.get(visitEnteredAt)).includes(activeProfileId)
}

/** Label for History rows: single name, or Ambos when co-owned. */
export function visitOwnerLabel(
  visitEnteredAt: string,
  byVisit: Map<string, VisitAttribution>,
  nameOf: (id: string) => string | null
): string | null {
  const owners = visitOwnerIds(byVisit.get(visitEnteredAt))
  if (owners.length === 0) return null
  if (owners.length >= 2) return 'Ambos fomos ao supermercado'
  return nameOf(owners[0])
}

/** Visits that count toward spend (any attributed visit — family always shares). */
export function visitCountsTowardSpend(
  visitEnteredAt: string,
  activeProfileId: string | null,
  byVisit: Map<string, VisitAttribution>
): boolean {
  if (!activeProfileId) return true
  return visitOwnerIds(byVisit.get(visitEnteredAt)).length > 0
}
