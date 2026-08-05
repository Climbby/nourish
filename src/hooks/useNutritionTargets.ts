import { useCallback, useEffect, useState } from 'react'
import { useProfileScopedKey } from './useProfileScopedKey'

const LEGACY_KEY = 'nourish-nutrition-targets'

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

type StoredTargets = NutritionTargets & { enabled?: boolean }

function load(key: string): { targets: NutritionTargets; configured: boolean; enabled: boolean } {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return { targets: { ...DEFAULT_TARGETS }, configured: false, enabled: false }
    }
    const parsed = JSON.parse(raw) as StoredTargets
    const { enabled: storedEnabled, ...rest } = parsed
    const targets: NutritionTargets = {
      caloriesPerDay: typeof rest.caloriesPerDay === 'number' ? rest.caloriesPerDay : DEFAULT_TARGETS.caloriesPerDay,
      proteinPerDay: typeof rest.proteinPerDay === 'number' ? rest.proteinPerDay : DEFAULT_TARGETS.proteinPerDay,
      carbsPerDay: typeof rest.carbsPerDay === 'number' ? rest.carbsPerDay : DEFAULT_TARGETS.carbsPerDay,
      fatPerDay: typeof rest.fatPerDay === 'number' ? rest.fatPerDay : DEFAULT_TARGETS.fatPerDay,
    }
    const enabled = typeof storedEnabled === 'boolean' ? storedEnabled : true
    return { targets, configured: true, enabled }
  } catch {
    return { targets: { ...DEFAULT_TARGETS }, configured: false, enabled: false }
  }
}

function persist(key: string, targets: NutritionTargets, enabled: boolean) {
  const stored: StoredTargets = { ...targets, enabled }
  localStorage.setItem(key, JSON.stringify(stored))
}

export function useNutritionTargets() {
  const storageKey = useProfileScopedKey(LEGACY_KEY)
  const [targets, setTargetsState] = useState<NutritionTargets>(() => load(storageKey).targets)
  const [configured, setConfigured] = useState(() => load(storageKey).configured)
  const [enabled, setEnabledState] = useState(() => load(storageKey).enabled)

  useEffect(() => {
    const next = load(storageKey)
    setTargetsState(next.targets)
    setConfigured(next.configured)
    setEnabledState(next.enabled)
  }, [storageKey])

  const setEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next)
      setConfigured(true)
      setTargetsState((prev) => {
        persist(storageKey, prev, next)
        return prev
      })
    },
    [storageKey]
  )

  const setTargets = useCallback(
    (next: NutritionTargets) => {
      setTargetsState(next)
      setConfigured(true)
      setEnabledState((en) => {
        persist(storageKey, next, en)
        return en
      })
    },
    [storageKey]
  )

  const resetTargets = useCallback(() => {
    setTargets({ ...DEFAULT_TARGETS })
  }, [setTargets])

  return { targets, setTargets, resetTargets, configured, enabled, setEnabled }
}
