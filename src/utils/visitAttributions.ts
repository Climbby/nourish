export interface VisitAttribution {
  visit_entered_at: string
  owner_profile_id: string
  share_with_family: boolean
}

const LOCAL_KEY = 'nourish-visit-attributions'

function loadLocal(): VisitAttribution[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocal(list: VisitAttribution[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
}

export async function fetchVisitAttributions(): Promise<VisitAttribution[]> {
  try {
    const res = await fetch('/nourish/visit-attributions', { cache: 'no-store' })
    if (!res.ok) return loadLocal()
    const data = (await res.json()) as { attributions?: VisitAttribution[] }
    const list = Array.isArray(data.attributions) ? data.attributions : []
    saveLocal(list)
    return list
  } catch {
    return loadLocal()
  }
}

export async function upsertVisitAttribution(row: VisitAttribution): Promise<VisitAttribution[]> {
  const list = loadLocal().filter((a) => a.visit_entered_at !== row.visit_entered_at)
  list.push(row)
  saveLocal(list)
  try {
    const res = await fetch('/nourish/visit-attributions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    })
    if (res.ok) {
      const data = (await res.json()) as { attributions?: VisitAttribution[] }
      if (Array.isArray(data.attributions)) {
        saveLocal(data.attributions)
        return data.attributions
      }
    }
  } catch {
    /* local fallback */
  }
  return list
}

export function visitAttributionMap(list: VisitAttribution[]): Map<string, VisitAttribution> {
  return new Map(list.map((a) => [a.visit_entered_at, a]))
}

/** Visible to active profile: owned by me, shared with family, or unattributed (claimable). */
export function isVisitVisibleToProfile(
  visitEnteredAt: string,
  activeProfileId: string | null,
  byVisit: Map<string, VisitAttribution>
): boolean {
  if (!activeProfileId) return true
  const attr = byVisit.get(visitEnteredAt)
  if (!attr) return true // unattributed — show in claim bucket
  return attr.owner_profile_id === activeProfileId || attr.share_with_family
}

export function isVisitOwnedBy(
  visitEnteredAt: string,
  profileId: string,
  byVisit: Map<string, VisitAttribution>
): boolean {
  return byVisit.get(visitEnteredAt)?.owner_profile_id === profileId
}

export function isVisitUnattributed(
  visitEnteredAt: string,
  byVisit: Map<string, VisitAttribution>
): boolean {
  return !byVisit.has(visitEnteredAt)
}

/** Visits that count toward personal spend (mine, or shared — not merely unattributed). */
export function visitCountsTowardSpend(
  visitEnteredAt: string,
  activeProfileId: string | null,
  byVisit: Map<string, VisitAttribution>
): boolean {
  if (!activeProfileId) return true
  const attr = byVisit.get(visitEnteredAt)
  if (!attr) return false
  return attr.owner_profile_id === activeProfileId || attr.share_with_family
}
