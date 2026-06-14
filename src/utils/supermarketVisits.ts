export type SupermarketEventType = 'supermarket_enter' | 'supermarket_leave'

export interface SupermarketEvent {
  type: SupermarketEventType
  at: string
  zone?: string
}

export interface SupermarketVisit {
  entered_at: string
  left_at: string | null
  duration_minutes: number | null
  ongoing: boolean
  zone?: string
  trip_distance_km?: number
  trip_distance_source?: 'osrm' | 'zones'
}

/** Open visit older than this is no longer "still in store". */
export const ONGOING_MAX_MS = 4 * 60 * 60 * 1000

/** Ignore duplicate enter events within this window (HA/GPS bounce). */
export const ENTER_DEBOUNCE_MS = 2 * 60 * 1000

/** Ignore leave events this soon after enter (GPS zone edge bounce). */
export const LEAVE_BOUNCE_MS = 15 * 1000

/** Merge consecutive visits when the gap between them is smaller than this. */
export const VISIT_MERGE_GAP_MS = 2 * 60 * 1000

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const WEEKDAYS_PT_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function parseMs(iso: string): number {
  return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T')).getTime()
}

function finalizeOpenVisit(visit: SupermarketVisit, nowMs: number): SupermarketVisit {
  if (!visit.ongoing) return visit
  const enteredMs = parseMs(visit.entered_at)
  if (!Number.isFinite(enteredMs) || nowMs - enteredMs <= ONGOING_MAX_MS) return visit
  return { ...visit, ongoing: false }
}

function shouldConsolidateVisits(a: SupermarketVisit, b: SupermarketVisit): boolean {
  const aEndMs = a.left_at ? parseMs(a.left_at) : parseMs(a.entered_at)
  const bStartMs = parseMs(b.entered_at)
  if (!Number.isFinite(aEndMs) || !Number.isFinite(bStartMs)) return false
  const gap = bStartMs - aEndMs
  if (gap > VISIT_MERGE_GAP_MS) return false
  // Bounce stub (0–1 min) immediately before the real visit
  if ((a.duration_minutes ?? 0) <= 1) return true
  // Duplicate-enter artifact: second stub at the same moment
  if (gap <= 0 && (b.duration_minutes ?? 0) <= 1) return true
  return false
}

function consolidateVisits(a: SupermarketVisit, b: SupermarketVisit): SupermarketVisit {
  const enteredMs = Math.min(parseMs(a.entered_at), parseMs(b.entered_at))
  const leftCandidates = [a.left_at, b.left_at].filter(Boolean) as string[]
  const left = leftCandidates.length
    ? leftCandidates.reduce((latest, cur) => (parseMs(cur) > parseMs(latest) ? cur : latest))
    : null
  const leftMs = left ? parseMs(left) : null
  return {
    entered_at: new Date(enteredMs).toISOString(),
    left_at: left,
    duration_minutes:
      leftMs != null && Number.isFinite(enteredMs)
        ? Math.max(0, Math.round((leftMs - enteredMs) / 60000))
        : null,
    ongoing: a.ongoing || b.ongoing,
    zone: a.zone ?? b.zone,
    trip_distance_km: a.trip_distance_km ?? b.trip_distance_km,
    trip_distance_source: a.trip_distance_source ?? b.trip_distance_source,
  }
}

function mergeAdjacentVisits(visits: SupermarketVisit[]): SupermarketVisit[] {
  const sorted = [...visits].sort((a, b) => a.entered_at.localeCompare(b.entered_at))
  const merged: SupermarketVisit[] = []
  for (const v of sorted) {
    const prev = merged[merged.length - 1]
    if (prev && shouldConsolidateVisits(prev, v)) {
      merged[merged.length - 1] = consolidateVisits(prev, v)
    } else {
      merged.push(v)
    }
  }
  return merged
}

export function buildSupermarketVisits(
  events: SupermarketEvent[],
  nowMs: number = Date.now()
): SupermarketVisit[] {
  const shopEvents = events
    .filter((e) => e.type === 'supermarket_enter' || e.type === 'supermarket_leave')
    .map((e) => ({ type: e.type, at: e.at, zone: e.zone, t: parseMs(e.at) }))
    .filter((e) => Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t)

  const visits: SupermarketVisit[] = []
  let openEnter: (typeof shopEvents)[number] | null = null

  const closeOpen = (endMs: number | null) => {
    if (!openEnter) return
    const enteredAt = new Date(openEnter.t).toISOString()
    if (endMs == null) {
      visits.push({
        entered_at: enteredAt,
        left_at: null,
        duration_minutes: null,
        ongoing: true,
        ...(openEnter.zone ? { zone: openEnter.zone } : {}),
      })
    } else {
      visits.push({
        entered_at: enteredAt,
        left_at: new Date(endMs).toISOString(),
        duration_minutes: Math.max(0, Math.round((endMs - openEnter.t) / 60000)),
        ongoing: false,
        ...(openEnter.zone ? { zone: openEnter.zone } : {}),
      })
    }
    openEnter = null
  }

  for (const ev of shopEvents) {
    if (ev.type === 'supermarket_enter') {
      if (openEnter && ev.t - openEnter.t < ENTER_DEBOUNCE_MS) {
        if (ev.zone && !openEnter.zone) openEnter.zone = ev.zone
        continue
      }
      if (openEnter) closeOpen(ev.t)
      openEnter = ev
    } else if (openEnter) {
      if (ev.t - openEnter.t < LEAVE_BOUNCE_MS) continue
      closeOpen(ev.t)
    } else {
      const last = visits[visits.length - 1]
      if (last?.left_at && (last.duration_minutes ?? 0) <= 1) {
        const enteredMs = parseMs(last.entered_at)
        if (Number.isFinite(enteredMs) && ev.t > enteredMs && ev.t - enteredMs < ONGOING_MAX_MS) {
          visits[visits.length - 1] = {
            ...last,
            left_at: new Date(ev.t).toISOString(),
            duration_minutes: Math.max(0, Math.round((ev.t - enteredMs) / 60000)),
            ongoing: false,
          }
        }
      }
    }
  }

  if (openEnter) closeOpen(null)

  return mergeAdjacentVisits(visits.map((v) => finalizeOpenVisit(v, nowMs))).sort((a, b) =>
    b.entered_at.localeCompare(a.entered_at)
  )
}

export function formatVisitDuration(minutes: number | null, ongoing: boolean): string {
  if (ongoing) return 'Ainda no super'
  if (minutes == null) return '—'
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} h ${m} min` : `${h} h`
}

export function visitHasExit(visit: SupermarketVisit): boolean {
  if (visit.left_at) return true
  if (visit.duration_minutes != null && visit.duration_minutes >= 0) return true
  return false
}

export function visitExitTime(visit: SupermarketVisit): string | null {
  if (visit.left_at) return visit.left_at
  if (visit.duration_minutes == null || visit.ongoing) return null
  const enteredMs = parseMs(visit.entered_at)
  if (!Number.isFinite(enteredMs)) return null
  return new Date(enteredMs + visit.duration_minutes * 60000).toISOString()
}

export function visitStatusLabel(visit: SupermarketVisit, nowMs: number = Date.now()): string | null {
  if (visitExitTime(visit)) return null
  if (visit.ongoing) return 'Ainda no super'
  const enteredMs = parseMs(visit.entered_at)
  if (Number.isFinite(enteredMs) && nowMs - enteredMs > ONGOING_MAX_MS) return null
  return 'Saída não registada'
}

export function formatVisitMonthYear(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  return `${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`
}

export function visitMonthYearKey(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatVisitDayLabel(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  return `${WEEKDAYS_PT_SHORT[d.getDay()]} ${d.getDate()}`
}

export function formatVisitWeekday(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  return WEEKDAYS_PT_SHORT[d.getDay()]
}

export function formatVisitDayNumber(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  return String(d.getDate())
}

export function formatVisitClock(ts: string): string {
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'))
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function visitClockRange(visit: SupermarketVisit): { enter: string; exit: string | null } {
  const exit = visitExitTime(visit)
  return {
    enter: formatVisitClock(visit.entered_at),
    exit: exit ? formatVisitClock(exit) : null,
  }
}

/** Weekday + day and entry/exit times (e.g. "Sáb 14 · 10:30 → 11:15"). */
export function formatVisitTimeRange(visit: SupermarketVisit): string {
  const dayLabel = formatVisitDayLabel(visit.entered_at)
  const enter = formatVisitClock(visit.entered_at)
  const exit = visitExitTime(visit)
  if (exit) return `${dayLabel} · ${enter} → ${formatVisitClock(exit)}`
  return `${dayLabel} · ${enter}`
}
