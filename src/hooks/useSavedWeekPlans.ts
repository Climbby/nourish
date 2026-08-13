import { useCallback, useEffect, useState } from 'react'
import { useProfileScopedKey } from './useProfileScopedKey'
import {
  clonePlan,
  parseSavedPlans,
  removePlan as removeFromList,
  upsertPlan,
  type SavedWeekPlan,
} from '../utils/savedWeekPlans'

const LEGACY_KEY = 'nourish-saved-week-plans'

function load(key: string): SavedWeekPlan[] {
  try {
    return parseSavedPlans(localStorage.getItem(key))
  } catch {
    return []
  }
}

export function useSavedWeekPlans() {
  const storageKey = useProfileScopedKey(LEGACY_KEY)
  const [plans, setPlans] = useState<SavedWeekPlan[]>(() => load(storageKey))

  useEffect(() => {
    setPlans(load(storageKey))
  }, [storageKey])

  const persist = useCallback(
    (next: SavedWeekPlan[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* quota — keep the in-memory list usable anyway */
      }
      setPlans(next)
    },
    [storageKey]
  )

  const save = useCallback(
    (plan: SavedWeekPlan) => {
      persist(upsertPlan(load(storageKey), plan))
    },
    [persist, storageKey]
  )

  const remove = useCallback(
    (id: string) => {
      persist(removeFromList(load(storageKey), id))
    },
    [persist, storageKey]
  )

  const duplicate = useCallback(
    (plan: SavedWeekPlan, name: string) => {
      const copy = clonePlan(plan, name)
      persist(upsertPlan(load(storageKey), copy))
      return copy
    },
    [persist, storageKey]
  )

  return { plans, save, remove, duplicate }
}
