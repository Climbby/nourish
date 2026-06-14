import { useCallback, useState } from 'react'

const STORAGE_KEY = 'nourish-planned-meals'

export interface PlannedMealEntry {
  recipeId: number
  addedAt: string
}

function load(): PlannedMealEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PlannedMealEntry[]) : []
  } catch {
    return []
  }
}

function save(entries: PlannedMealEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function usePlannedMeals() {
  const [planned, setPlanned] = useState<PlannedMealEntry[]>(load)

  const add = useCallback((recipeId: number) => {
    setPlanned((prev) => {
      if (prev.some((e) => e.recipeId === recipeId)) return prev
      const next = [...prev, { recipeId, addedAt: new Date().toISOString() }]
      save(next)
      return next
    })
  }, [])

  const addMany = useCallback((recipeIds: number[]) => {
    setPlanned((prev) => {
      const existing = new Set(prev.map((e) => e.recipeId))
      const toAdd = recipeIds.filter((id) => !existing.has(id))
      if (toAdd.length === 0) return prev
      const now = new Date().toISOString()
      const next = [...prev, ...toAdd.map((recipeId) => ({ recipeId, addedAt: now }))]
      save(next)
      return next
    })
  }, [])

  const remove = useCallback((recipeId: number) => {
    setPlanned((prev) => {
      const next = prev.filter((e) => e.recipeId !== recipeId)
      save(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    save([])
    setPlanned([])
  }, [])

  const isPlanned = useCallback(
    (recipeId: number) => planned.some((e) => e.recipeId === recipeId),
    [planned]
  )

  return { planned, add, addMany, remove, clear, isPlanned }
}
