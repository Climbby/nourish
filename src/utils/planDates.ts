/**
 * Date arithmetic for the rolling plan window.
 *
 * Every plan date is an ISO `yyyy-mm-dd` in **local** time. Slots used to be
 * keyed by an offset relative to today, which meant a day silently changed
 * meaning at midnight and the whole plan had to be thrown away to stay
 * coherent. Absolute dates remove the problem by construction.
 *
 * Dates are anchored at noon before any arithmetic so a DST jump can never
 * push a day across a boundary.
 */

/** How far back the plan keeps a record before pruning. */
export const PAST_WINDOW_DAYS = 7

/** How far ahead the plan can be filled in. */
export const MAX_FUTURE_DAYS = 7

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(y, m - 1, d, 12)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export function isoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Local noon on that calendar day — never UTC midnight, which can shift the day. */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function diffDays(from: string, to: string): number {
  const ms = parseIsoDate(to).getTime() - parseIsoDate(from).getTime()
  return Math.round(ms / 86_400_000)
}

/** Oldest date the plan still keeps. Anything before this is pruned on load. */
export function pruneCutoff(today: string, window = PAST_WINDOW_DAYS): string {
  return addDays(today, -window)
}
