import { useEffect, useState } from 'react'
import { useProfileScopedKey } from './useProfileScopedKey'
import {
  GENERICO_FAVORITES_KEY,
  loadGenericoFavorites,
  setGenericoFavorite,
  type GenericoFavorites,
} from '../utils/genericoFavorites'

export function useGenericoFavorites() {
  const storageKey = useProfileScopedKey(GENERICO_FAVORITES_KEY)
  const [favorites, setFavorites] = useState<GenericoFavorites>(() => loadGenericoFavorites())

  useEffect(() => {
    setFavorites(loadGenericoFavorites())
  }, [storageKey])

  const setFavorite = (familyKey: string, productId: number) => {
    setFavorites(setGenericoFavorite(familyKey, productId))
  }

  return {
    favorites,
    setFavorite,
    favoriteId: (familyKey: string) => favorites[familyKey],
  }
}
