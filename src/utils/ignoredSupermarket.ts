import { normalizePlaceKey } from './supermarketSearch'
import type { BlockedPlace } from './supermarkets'

/** Longest-first so "pingo_doce" wins over a stray "doce". */
const BRAND_KEYS = [
  'pingo_doce',
  'minipreco',
  'intermarche',
  'continente',
  'mercadona',
  'auchan',
  'lidl',
  'aldi',
]

const STORE_PREFIX = /^(zone|receipt)\./i

export interface SupermarketIdentity {
  zone?: string | null
  storeId?: string | null
  name?: string | null
  storeLabel?: string | null
}

export interface IgnoredPlaceRef {
  place_key: string
  name: string
  zone_id?: string
}

function keysOverlap(a: string, b: string): boolean {
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

/** Strip zone./receipt. then accent-fold to the same key used when ignoring. */
export function supermarketIdentityKey(raw: string | undefined | null): string {
  if (!raw) return ''
  return normalizePlaceKey(String(raw).replace(STORE_PREFIX, ''))
}

function splitBrandLocality(key: string): { brand: string | null; locality: string[] } {
  for (const brand of BRAND_KEYS) {
    if (
      key === brand ||
      key.startsWith(`${brand}_`) ||
      key.endsWith(`_${brand}`) ||
      key.includes(`_${brand}_`)
    ) {
      const rest = key.replace(brand, '').replace(/^_|_$/g, '').replace(/_+/g, '_')
      const locality = rest.split('_').filter((t) => t.length > 1)
      return { brand, locality }
    }
  }
  return { brand: null, locality: key.split('_').filter((t) => t.length > 1) }
}

function brandLocalityMatch(a: string, b: string): boolean {
  const sa = splitBrandLocality(a)
  const sb = splitBrandLocality(b)
  if (!sa.brand || !sb.brand || sa.brand !== sb.brand) return false
  if (sa.locality.length === 0 || sb.locality.length === 0) return true
  return sa.locality.some((t) => sb.locality.includes(t))
}

function blockedKeys(blocked: IgnoredPlaceRef): string[] {
  return [
    supermarketIdentityKey(blocked.place_key),
    supermarketIdentityKey(blocked.zone_id),
    supermarketIdentityKey(blocked.name),
  ].filter(Boolean)
}

function identityKeys(identity: SupermarketIdentity): string[] {
  return [
    supermarketIdentityKey(identity.zone),
    supermarketIdentityKey(identity.storeId),
    supermarketIdentityKey(identity.name),
    supermarketIdentityKey(identity.storeLabel),
  ].filter(Boolean)
}

export function identityMatchesBlocked(
  identity: SupermarketIdentity,
  blocked: IgnoredPlaceRef
): boolean {
  const blockedIdents = blockedKeys(blocked)
  const candidates = identityKeys(identity)
  for (const candidate of candidates) {
    for (const blockedKey of blockedIdents) {
      if (keysOverlap(candidate, blockedKey) || brandLocalityMatch(candidate, blockedKey)) {
        return true
      }
    }
  }
  return false
}

export function isIgnoredSupermarketIdentity(
  identity: SupermarketIdentity,
  blocklist: IgnoredPlaceRef[]
): boolean {
  if (blocklist.length === 0) return false
  return blocklist.some((b) => identityMatchesBlocked(identity, b))
}

export function visitIsIgnored(
  visit: { zone?: string },
  blocklist: IgnoredPlaceRef[],
  visitLabel?: string
): boolean {
  return isIgnoredSupermarketIdentity({ zone: visit.zone, name: visitLabel }, blocklist)
}

export function filterIgnoredVisits<T extends { zone?: string }>(
  visits: T[],
  blocklist: IgnoredPlaceRef[],
  labelFor?: (visit: T) => string
): T[] {
  if (blocklist.length === 0) return visits
  return visits.filter((v) => !visitIsIgnored(v, blocklist, labelFor?.(v)))
}

export function isIgnoredStorePrice(
  row: { store_id?: string; store_label?: string },
  blocklist: IgnoredPlaceRef[]
): boolean {
  return isIgnoredSupermarketIdentity(
    { storeId: row.store_id, storeLabel: row.store_label },
    blocklist
  )
}

/** Name + zone to send to the same block API as Perfil → Ignorados. */
export function ignoreTargetForVisit(
  visit: { zone?: string },
  tracked: { name: string; place_key: string; zone_id?: string }[],
  label: string
): { place: string; zone_id?: string } {
  const byZone = tracked.find((t) => (t.zone_id || `zone.${t.place_key}`) === visit.zone)
  if (byZone) {
    return { place: byZone.name, zone_id: byZone.zone_id || visit.zone }
  }
  const place =
    label && label !== 'Supermercado'
      ? label
      : visit.zone
        ? visit.zone.replace(/^zone\./, '').replace(/_/g, ' ')
        : label
  return { place, zone_id: visit.zone }
}
