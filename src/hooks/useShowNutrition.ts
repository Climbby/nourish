import { useNutritionTargets } from './useNutritionTargets'
import { useUserProfile } from './useUserProfile'

/** True when personal data and/or nutrition targets are enabled — show macros in the UI. */
export function useShowNutrition(): boolean {
  const { enabled: profileEnabled } = useUserProfile()
  const { enabled: targetsEnabled } = useNutritionTargets()
  return profileEnabled || targetsEnabled
}
