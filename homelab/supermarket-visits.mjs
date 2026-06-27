/** @typedef {{ type: 'supermarket_enter' | 'supermarket_leave', at: string, zone?: string }} SupermarketEvent */

const ONGOING_MAX_MS = 4 * 60 * 60 * 1000
const ENTER_DEBOUNCE_MS = 2 * 60 * 1000
const LEAVE_BOUNCE_MS = 15 * 1000
const VISIT_MERGE_GAP_MS = 2 * 60 * 1000
/** Shorter completed visits are drive-bys (GPS clipped the zone). */
const MIN_VISIT_DURATION_MINUTES = 3

function parseMs(iso) {
  return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T')).getTime()
}

function finalizeOpenVisit(visit, nowMs) {
  if (!visit.ongoing) return visit
  const enteredMs = parseMs(visit.entered_at)
  if (!Number.isFinite(enteredMs) || nowMs - enteredMs <= ONGOING_MAX_MS) return visit
  return { ...visit, ongoing: false }
}

function shouldConsolidateVisits(a, b) {
  const aEndMs = a.left_at ? parseMs(a.left_at) : parseMs(a.entered_at)
  const bStartMs = parseMs(b.entered_at)
  if (!Number.isFinite(aEndMs) || !Number.isFinite(bStartMs)) return false
  const gap = bStartMs - aEndMs
  if (gap > VISIT_MERGE_GAP_MS) return false
  if ((a.duration_minutes ?? 0) <= 1) return true
  if (gap <= 0 && (b.duration_minutes ?? 0) <= 1) return true
  return false
}

function consolidateVisits(a, b) {
  const enteredMs = Math.min(parseMs(a.entered_at), parseMs(b.entered_at))
  const leftCandidates = [a.left_at, b.left_at].filter(Boolean)
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
    ...(a.zone || b.zone ? { zone: a.zone ?? b.zone } : {}),
  }
}

function mergeAdjacentVisits(visits) {
  const sorted = [...visits].sort((a, b) => a.entered_at.localeCompare(b.entered_at))
  const merged = []
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

/**
 * @param {SupermarketEvent[]} events
 * @param {number} [nowMs]
 */
export function buildSupermarketVisits(events, nowMs = Date.now()) {
  const shopEvents = events
    .filter((e) => e.type === 'supermarket_enter' || e.type === 'supermarket_leave')
    .map((e) => ({ type: e.type, at: e.at, zone: e.zone, t: parseMs(e.at) }))
    .filter((e) => Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t)

  const visits = []
  let openEnter = null

  const closeOpen = (endMs) => {
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

/** Median days between merged visit entry times (same visits as /supermarket-visits). */
export function medianDaysBetweenVisits(visits) {
  if (!visits || visits.length < 2) return null
  const times = visits
    .map((v) => parseMs(v.entered_at))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  if (times.length < 2) return null
  const gaps = []
  for (let i = 1; i < times.length; i++) {
    gaps.push((times[i] - times[i - 1]) / 86400000)
  }
  gaps.sort((a, b) => a - b)
  const median = gaps[Math.floor(gaps.length / 2)]
  return median > 0 ? Math.round(median * 10) / 10 : null
}

export function isRealSupermarketVisit(visit) {
  if (visit.ongoing) return true
  if (visit.duration_minutes == null) return false
  return visit.duration_minutes >= MIN_VISIT_DURATION_MINUTES
}

export function realSupermarketVisits(visits) {
  return visits.filter(isRealSupermarketVisit)
}
