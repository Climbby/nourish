/** @typedef {{ type: 'supermarket_enter' | 'supermarket_leave', at: string }} SupermarketEvent */

const ONGOING_MAX_MS = 4 * 60 * 60 * 1000

function finalizeOpenVisit(visit, nowMs) {
  if (!visit.ongoing) return visit
  const enteredMs = new Date(visit.entered_at).getTime()
  if (!Number.isFinite(enteredMs) || nowMs - enteredMs <= ONGOING_MAX_MS) return visit
  return { ...visit, ongoing: false }
}

/**
 * @param {SupermarketEvent[]} events
 * @param {number} [nowMs]
 * @returns {{ entered_at: string, left_at: string | null, duration_minutes: number | null, ongoing: boolean }[]}
 */
export function buildSupermarketVisits(events, nowMs = Date.now()) {
  const shopEvents = events
    .filter((e) => e.type === 'supermarket_enter' || e.type === 'supermarket_leave')
    .map((e) => ({ type: e.type, at: e.at, t: new Date(e.at).getTime() }))
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
      })
    } else {
      visits.push({
        entered_at: enteredAt,
        left_at: new Date(endMs).toISOString(),
        duration_minutes: Math.max(0, Math.round((endMs - openEnter.t) / 60000)),
        ongoing: false,
      })
    }
    openEnter = null
  }

  for (const ev of shopEvents) {
    if (ev.type === 'supermarket_enter') {
      if (openEnter) {
        closeOpen(null)
        visits[visits.length - 1] = { ...visits[visits.length - 1], ongoing: false }
      }
      openEnter = ev
    } else if (openEnter) {
      closeOpen(ev.t)
    }
  }

  if (openEnter) closeOpen(null)

  return visits
    .map((v) => finalizeOpenVisit(v, nowMs))
    .sort((a, b) => b.entered_at.localeCompare(a.entered_at))
}
