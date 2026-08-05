import { useCallback, useEffect, useState } from 'react'
import type { MealSortMode } from '../utils/mealSort'
import { DEFAULT_MEAL_SORT } from '../utils/mealSort'
import { useProfileScopedKey } from './useProfileScopedKey'

const LEGACY_KEY = 'nourish-display-prefs'

export type DefaultTab = 'meals' | 'plan'
export type MealListView = 'cards' | 'list'

export interface DisplayPrefs {
  showMealPortions: boolean
  mealSort: MealSortMode
  defaultTab: DefaultTab
  mealListView: MealListView
}

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  showMealPortions: true,
  mealSort: DEFAULT_MEAL_SORT,
  defaultTab: 'plan',
  mealListView: 'cards',
}

function load(key: string): DisplayPrefs {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { ...DEFAULT_DISPLAY_PREFS }
    const merged = { ...DEFAULT_DISPLAY_PREFS, ...JSON.parse(raw) } as DisplayPrefs
    if (merged.defaultTab !== 'meals' && merged.defaultTab !== 'plan') {
      merged.defaultTab = DEFAULT_DISPLAY_PREFS.defaultTab
    }
    if (merged.mealListView !== 'cards' && merged.mealListView !== 'list') {
      merged.mealListView = DEFAULT_DISPLAY_PREFS.mealListView
    }
    return merged
  } catch {
    return { ...DEFAULT_DISPLAY_PREFS }
  }
}

export function useDisplayPrefs() {
  const storageKey = useProfileScopedKey(LEGACY_KEY)
  const [prefs, setPrefsState] = useState<DisplayPrefs>(() => load(storageKey))

  useEffect(() => {
    setPrefsState(load(storageKey))
  }, [storageKey])

  const updatePref = useCallback(
    <K extends keyof DisplayPrefs>(key: K, value: DisplayPrefs[K]) => {
      setPrefsState((prev) => {
        const next = { ...prev, [key]: value }
        localStorage.setItem(storageKey, JSON.stringify(next))
        return next
      })
    },
    [storageKey]
  )

  return { prefs, updatePref }
}
