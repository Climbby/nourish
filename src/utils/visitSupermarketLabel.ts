import type { SupermarketVisit } from './supermarketVisits'
import type { TrackedSupermarket } from './supermarkets'

const KNOWN_STORE_LABELS: Record<string, string> = {
  auchan: 'Auchan',
  continente: 'Continente',
  lidl: 'Lidl',
  pingo_doce: 'Pingo Doce',
  minipreco: 'Minipreço',
}

/** Human-readable supermarket name from a HA zone id (e.g. zone.auchan). */
export function supermarketLabelFromZone(
  zone: string | undefined,
  tracked: TrackedSupermarket[] = []
): string {
  if (!zone) return 'Supermercado'
  const byZone = tracked.find((t) => t.zone_id === zone)
  if (byZone) return byZone.name
  const key = zone.replace(/^zone\./, '')
  return KNOWN_STORE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
}

export function supermarketLabelForVisit(
  visit: Pick<SupermarketVisit, 'zone'>,
  tracked: TrackedSupermarket[] = []
): string {
  return supermarketLabelFromZone(visit.zone, tracked)
}

/** Trip labels — driving distance is always home ↔ supermarket zone centres. */
export const TRIP_ORIGIN_LABEL = 'Casa'

export function formatTripRouteLabel(km?: number | null, supermarketName?: string): string {
  const route = supermarketName
    ? `${TRIP_ORIGIN_LABEL} → ${supermarketName}`
    : TRIP_ORIGIN_LABEL
  if (km != null && km > 0) return `${route} · ${km} km ida/volta`
  return route
}
