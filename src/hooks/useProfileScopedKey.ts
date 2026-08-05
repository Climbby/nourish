import { useEffect, useState } from 'react'
import { getActiveProfileId, onActiveProfileChange, profileScopedKey } from '../utils/householdProfiles'

/** Re-compute a namespaced localStorage key when the active profile changes. */
export function useProfileScopedKey(legacyKey: string): string {
  const [key, setKey] = useState(() => profileScopedKey(legacyKey))
  useEffect(() => {
    const sync = () => setKey(profileScopedKey(legacyKey, getActiveProfileId()))
    sync()
    return onActiveProfileChange(sync)
  }, [legacyKey])
  return key
}
