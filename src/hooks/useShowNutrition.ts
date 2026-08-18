import { useDisplayPrefs } from './useDisplayPrefs'
import { useNutritionTargets } from './useNutritionTargets'
import { useUserProfile } from './useUserProfile'

/**
 * True when macros should appear in the UI.
 * Requires personal data and/or nutrition targets, and the display pref must not hide nutrition.
 */
export function useShowNutrition(): boolean {
  const { enabled: profileEnabled } = useUserProfile()
  const { enabled: targetsEnabled } = useNutritionTargets()
  const { prefs } = useDisplayPrefs()
  return (profileEnabled || targetsEnabled) && !prefs.hideNutrition
}
