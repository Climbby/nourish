import type { SupermarketVisit } from '../../api/homelabMetrics'
import type { VisionReceipt } from './extractReceiptVision'

const TZ = 'Europe/Lisbon'
const DEFAULT_TOLERANCE_MS = 15 * 60 * 1000

/** Brand token used to match HA zone ids like zone.continente_bom_dia_…. */
export function storeBrandToken(store: VisionReceipt['store']): string | null {
  if (store === 'auchan') return 'auchan'
  if (store === 'continente') return 'continente'
  return null
}

/** @deprecated Prefer zoneMatchesStore — kept for tests / callers expecting a prefix. */
export function storeToZone(store: VisionReceipt['store']): string | null {
  const brand = storeBrandToken(store)
  return brand ? `zone.${brand}` : null
}

/** True when visit zone belongs to the detected store brand (substring match). */
export function zoneMatchesStore(zone: string | undefined, store: VisionReceipt['store']): boolean {
  const brand = storeBrandToken(store)
  if (!brand) return true
  if (!zone) return true
  return zone.toLowerCase().includes(brand)
}

/** Offset (local − UTC) in ms for a given instant in `tz`. */
function tzOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(instant)
  const m: Record<string, string> = {}
  for (const p of parts) m[p.type] = p.value
  const asUtc = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second)
  return asUtc - instant.getTime()
}

/**
 * Receipt timestamps are local wall-clock (no tz). Interpret them in Lisbon time
 * and return the UTC epoch ms, so they can be compared to UTC visit windows.
 */
export function localReceiptToUtcMs(local: string | null, tz = TZ): number | null {
  if (!local) return null
  const m = local.trim().match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const wallAsUtcMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0))
  const offset = tzOffsetMs(new Date(wallAsUtcMs), tz)
  return wallAsUtcMs - offset
}

/**
 * Find the supermarket visit whose enter→leave window contains the receipt
 * timestamp (± tolerance). When the store maps to a known brand, visits in a
 * different brand zone are excluded. Ties broken by proximity to the visit centre.
 */
export function matchVisitForReceipt(
  receiptLocal: string | null,
  store: VisionReceipt['store'],
  visits: SupermarketVisit[],
  toleranceMs = DEFAULT_TOLERANCE_MS
): SupermarketVisit | null {
  const receiptMs = localReceiptToUtcMs(receiptLocal)
  if (receiptMs == null) return null

  let best: SupermarketVisit | null = null
  let bestDist = Infinity

  for (const v of visits) {
    const enter = Date.parse(v.entered_at)
    if (!Number.isFinite(enter)) continue
    const leave = v.left_at ? Date.parse(v.left_at) : enter
    if (!zoneMatchesStore(v.zone, store)) continue
    if (receiptMs < enter - toleranceMs || receiptMs > leave + toleranceMs) continue

    const dist = Math.abs(receiptMs - (enter + leave) / 2)
    if (dist < bestDist) {
      bestDist = dist
      best = v
    }
  }

  return best
}
