import type { TrackedSupermarket } from '../../utils/supermarkets'
import type { ReceiptStore } from './types'
import { storeBrandToken } from './matchVisit'

export interface ResolvedReceiptStore {
  store_id: string
  store_label: string
}

const FALLBACK_LABELS: Record<Exclude<ReceiptStore, 'mixed'>, string> = {
  continente: 'Continente',
  auchan: 'Auchan',
}

/**
 * Prefer a tracked HA zone for the receipt brand so prices group under the
 * real supermarket; otherwise fall back to receipt.<brand>.
 */
export function resolveReceiptStore(
  store: ReceiptStore | 'other' | null | undefined,
  tracked: TrackedSupermarket[],
  visitZone?: string | null
): ResolvedReceiptStore {
  if (visitZone) {
    const fromTracked = tracked.find(
      (t) => (t.zone_id || `zone.${t.place_key}`) === visitZone
    )
    return {
      store_id: visitZone,
      store_label: fromTracked?.name ?? humanizeZone(visitZone),
    }
  }

  const brand = storeBrandToken(store === 'mixed' || store == null ? null : store)
  if (!brand) {
    return { store_id: 'receipt.unknown', store_label: 'Loja' }
  }

  const match = tracked.find((t) => {
    const zone = (t.zone_id || `zone.${t.place_key}`).toLowerCase()
    const key = t.place_key.toLowerCase()
    const name = t.name.toLowerCase()
    return zone.includes(brand) || key.includes(brand) || name.includes(brand)
  })

  if (match) {
    return {
      store_id: match.zone_id || `zone.${match.place_key}`,
      store_label: match.name,
    }
  }

  const label =
    store === 'continente' || store === 'auchan'
      ? FALLBACK_LABELS[store]
      : brand.charAt(0).toUpperCase() + brand.slice(1)

  return {
    store_id: `receipt.${brand}`,
    store_label: label,
  }
}

function humanizeZone(zone: string): string {
  const s = zone.replace(/^zone\./, '').replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
