import { useCallback, useState } from 'react'
import {
  type UserBodyProfile,
  type ActivityLevel,
  type BodyGoal,
  type Sex,
} from '../utils/nutritionRecommendations'

const STORAGE_KEY = 'nourish-user-profile'

export const DEFAULT_USER_PROFILE: UserBodyProfile = {
  age: 30,
  sex: 'male',
  weightKg: 75,
  heightCm: 175,
  activity: 'moderate',
  goal: 'maintain',
}

function load(): UserBodyProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_USER_PROFILE }
    return { ...DEFAULT_USER_PROFILE, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_USER_PROFILE }
  }
}

export function useUserProfile() {
  const [profile, setProfileState] = useState<UserBodyProfile>(load)

  const setProfile = useCallback((next: UserBodyProfile) => {
    setProfileState(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const updateField = useCallback(
    <K extends keyof UserBodyProfile>(key: K, value: UserBodyProfile[K]) => {
      setProfileState((prev) => {
        const next = { ...prev, [key]: value }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
    },
    []
  )

  return { profile, setProfile, updateField }
}

export type { ActivityLevel, BodyGoal, Sex, UserBodyProfile }
