/** Overrides for supermarket visits: close incomplete trips or hide drive-bys. */

export type VisitOverrideAction = 'closed' | 'dismissed'

export interface VisitOverride {
  visit_entered_at: string
  action: VisitOverrideAction
  /** Estimated leave when action is `closed`. */
  left_at?: string | null
  updated_at: string
}

const LOCAL_KEY = 'nourish-visit-overrides'

function loadLocal(): VisitOverride[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocal(list: VisitOverride[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
}

export async function fetchVisitOverrides(): Promise<VisitOverride[]> {
  try {
    const res = await fetch('/nourish/visit-overrides', { cache: 'no-store' })
    if (!res.ok) return loadLocal()
    const data = (await res.json()) as { overrides?: VisitOverride[] }
    const list = Array.isArray(data.overrides) ? data.overrides : []
    saveLocal(list)
    return list
  } catch {
    return loadLocal()
  }
}

export async function upsertVisitOverride(override: VisitOverride): Promise<VisitOverride[]> {
  const list = loadLocal().filter((o) => o.visit_entered_at !== override.visit_entered_at)
  list.push(override)
  saveLocal(list)
  try {
    const res = await fetch('/nourish/visit-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(override),
    })
    if (res.ok) {
      const data = (await res.json()) as { overrides?: VisitOverride[] }
      if (Array.isArray(data.overrides)) {
        saveLocal(data.overrides)
        return data.overrides
      }
    }
  } catch {
    /* local fallback */
  }
  return list
}

export function visitOverrideMap(overrides: VisitOverride[]): Map<string, VisitOverride> {
  return new Map(overrides.map((o) => [o.visit_entered_at, o]))
}

/** Apply closed/dismissed overrides onto raw visits for UI. */
export function applyVisitOverrides<
  T extends {
    entered_at: string
    left_at: string | null
    duration_minutes: number | null
    ongoing: boolean
  },
>(visits: T[], overrides: VisitOverride[]): T[] {
  if (overrides.length === 0) return visits
  const map = visitOverrideMap(overrides)
  const out: T[] = []
  for (const v of visits) {
    const o = map.get(v.entered_at)
    if (!o) {
      out.push(v)
      continue
    }
    if (o.action === 'dismissed') continue
    if (o.action === 'closed') {
      const leftAt = o.left_at ?? null
      let duration = v.duration_minutes
      if (leftAt) {
        const entered = new Date(v.entered_at.includes('T') ? v.entered_at : v.entered_at.replace(' ', 'T')).getTime()
        const left = new Date(leftAt.includes('T') ? leftAt : leftAt.replace(' ', 'T')).getTime()
        if (Number.isFinite(entered) && Number.isFinite(left)) {
          duration = Math.max(0, Math.round((left - entered) / 60000))
        }
      }
      out.push({
        ...v,
        left_at: leftAt,
        duration_minutes: duration,
        ongoing: false,
      })
      continue
    }
    out.push(v)
  }
  return out
}

/** Default estimated leave: enter + 45 min (or now if sooner). */
export function estimateVisitLeftAt(enteredAt: string, nowMs: number = Date.now()): string {
  const entered = new Date(enteredAt.includes('T') ? enteredAt : enteredAt.replace(' ', 'T')).getTime()
  const guessed = entered + 45 * 60 * 1000
  return new Date(Math.min(guessed, nowMs)).toISOString()
}
