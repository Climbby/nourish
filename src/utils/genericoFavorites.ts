/**
 * One favorite SKU per [Generico] family, persisted in localStorage.
 * Grocy products stay separate — this only picks the representative variant.
 */

import { profileScopedKey } from './householdProfiles'

export const GENERICO_FAVORITES_KEY = 'nourish-generico-favorites'

/** familyKey → product id */
export type GenericoFavorites = Record<string, number>

export function loadGenericoFavorites(): GenericoFavorites {
  try {
    const raw = localStorage.getItem(profileScopedKey(GENERICO_FAVORITES_KEY))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    const out: GenericoFavorites = {}
    for (const [key, id] of Object.entries(parsed as Record<string, unknown>)) {
      if (!key.trim()) continue
      if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) continue
      out[key] = id
    }
    return out
  } catch {
    return {}
  }
}

export function saveGenericoFavorites(favorites: GenericoFavorites): void {
  try {
    localStorage.setItem(profileScopedKey(GENERICO_FAVORITES_KEY), JSON.stringify(favorites))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Set (or switch) the favorite variant for a family. One id per family key. */
export function setGenericoFavorite(familyKey: string, productId: number): GenericoFavorites {
  const key = familyKey.trim()
  if (!key || !Number.isFinite(productId) || productId <= 0) return loadGenericoFavorites()
  const next = { ...loadGenericoFavorites(), [key]: productId }
  saveGenericoFavorites(next)
  return next
}

/** Drop the favorite so meals ask again (pick every time). */
export function clearGenericoFavorite(familyKey: string): GenericoFavorites {
  const key = familyKey.trim()
  const current = loadGenericoFavorites()
  if (!key || current[key] == null) return current
  const next = { ...current }
  delete next[key]
  saveGenericoFavorites(next)
  return next
}

/** Star this SKU, or unstar it if it is already the favorite. */
export function toggleGenericoFavorite(familyKey: string, productId: number): GenericoFavorites {
  const key = familyKey.trim()
  if (!key || !Number.isFinite(productId) || productId <= 0) return loadGenericoFavorites()
  const current = loadGenericoFavorites()
  if (current[key] === productId) return clearGenericoFavorite(key)
  return setGenericoFavorite(key, productId)
}

export function getGenericoFavoriteId(
  familyKey: string,
  favorites: GenericoFavorites = loadGenericoFavorites()
): number | undefined {
  return favorites[familyKey]
}
