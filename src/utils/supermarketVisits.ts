export type SupermarketEventType = 'supermarket_enter' | 'supermarket_leave'

export interface SupermarketEvent {
  type: SupermarketEventType
  at: string
}

export interface SupermarketVisit {
  entered_at: string
  left_at: string | null
  duration_minutes: number | null
  ongoing: boolean
}

export function buildSupermarketVisits(events: SupermarketEvent[]): SupermarketVisit[] {
  const shopEvents = events
    .filter((e) => e.type === 'supermarket_enter' || e.type === 'supermarket_leave')
    .map((e) => ({ type: e.type, at: e.at, t: new Date(e.at).getTime() }))
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

  return visits.sort((a, b) => b.entered_at.localeCompare(a.entered_at))
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
