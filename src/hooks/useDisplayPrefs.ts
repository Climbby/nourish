import { useCallback, useState } from 'react'

const STORAGE_KEY = 'nourish-display-prefs'

export interface DisplayPrefs {
  showMealPortions: boolean
}

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  showMealPortions: true,
}

function load(): DisplayPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_DISPLAY_PREFS }
    return { ...DEFAULT_DISPLAY_PREFS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_DISPLAY_PREFS }
  }
}

export function useDisplayPrefs() {
  const [prefs, setPrefsState] = useState<DisplayPrefs>(load)

  const updatePref = useCallback(<K extends keyof DisplayPrefs>(key: K, value: DisplayPrefs[K]) => {
    setPrefsState((prev) => {
      const next = { ...prev, [key]: value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { prefs, updatePref }
}
