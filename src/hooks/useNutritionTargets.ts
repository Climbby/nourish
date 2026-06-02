import { useCallback, useState } from 'react'

const STORAGE_KEY = 'nourish-nutrition-targets'

export interface NutritionTargets {
  caloriesPerDay: number
  proteinPerDay: number
  carbsPerDay: number
  fatPerDay: number
}

export const DEFAULT_TARGETS: NutritionTargets = {
  caloriesPerDay: 2000,
  proteinPerDay: 120,
  carbsPerDay: 250,
  fatPerDay: 70,
}

function load(): NutritionTargets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_TARGETS }
    return { ...DEFAULT_TARGETS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_TARGETS }
  }
}

export function useNutritionTargets() {
  const [targets, setTargetsState] = useState<NutritionTargets>(load)

  const setTargets = useCallback((next: NutritionTargets) => {
    setTargetsState(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const resetTargets = useCallback(() => {
    setTargets({ ...DEFAULT_TARGETS })
  }, [setTargets])

  return { targets, setTargets, resetTargets }
}
