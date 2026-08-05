import { useEffect, useState } from 'react'
import { useProfileScopedKey } from './useProfileScopedKey'

const LEGACY_KEY = 'nourish-favourites'

function load(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
  } catch {
    return new Set()
  }
}

export function useFavourites() {
  const storageKey = useProfileScopedKey(LEGACY_KEY)
  const [favourites, setFavourites] = useState<Set<number>>(() => load(storageKey))

  useEffect(() => {
    setFavourites(load(storageKey))
  }, [storageKey])

  const toggle = (id: number) => {
    setFavourites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(storageKey, JSON.stringify([...next]))
      return next
    })
  }

  return {
    favourites,
    toggle,
    isFavourite: (id: number) => favourites.has(id),
  }
}
