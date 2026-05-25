import { useState } from 'react'

const STORAGE_KEY = 'nourish-favourites'

function load(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
  } catch {
    return new Set()
  }
}

export function useFavourites() {
  const [favourites, setFavourites] = useState<Set<number>>(load)

  const toggle = (id: number) => {
    setFavourites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  return {
    favourites,
    toggle,
    isFavourite: (id: number) => favourites.has(id),
  }
}
