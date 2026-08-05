import { useCallback, useEffect, useState } from 'react'
import {
  type UserBodyProfile,
  type ActivityLevel,
  type BodyGoal,
  type Sex,
  birthDateFromAge,
} from '../utils/nutritionRecommendations'
import { useProfileScopedKey } from './useProfileScopedKey'

const LEGACY_KEY = 'nourish-user-profile'

export const DEFAULT_USER_PROFILE: UserBodyProfile = {
  birthDate: birthDateFromAge(30),
  sex: 'male',
  weightKg: 75,
  heightCm: 175,
  activity: 'moderate',
  goal: 'maintain',
}

type StoredProfile = UserBodyProfile & { enabled?: boolean }

function migrate(raw: Record<string, unknown>): UserBodyProfile {
  const birthDate =
    typeof raw.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.birthDate)
      ? raw.birthDate
      : birthDateFromAge(typeof raw.age === 'number' && Number.isFinite(raw.age) ? raw.age : 30)

  return {
    ...DEFAULT_USER_PROFILE,
    sex: raw.sex === 'female' || raw.sex === 'male' ? raw.sex : DEFAULT_USER_PROFILE.sex,
    weightKg: typeof raw.weightKg === 'number' ? raw.weightKg : DEFAULT_USER_PROFILE.weightKg,
    heightCm: typeof raw.heightCm === 'number' ? raw.heightCm : DEFAULT_USER_PROFILE.heightCm,
    activity:
      typeof raw.activity === 'string' && raw.activity in { sedentary: 1, light: 1, moderate: 1, active: 1, very_active: 1 }
        ? (raw.activity as UserBodyProfile['activity'])
        : DEFAULT_USER_PROFILE.activity,
    goal:
      raw.goal === 'lose' || raw.goal === 'maintain' || raw.goal === 'gain'
        ? raw.goal
        : DEFAULT_USER_PROFILE.goal,
    birthDate,
  }
}

function load(key: string): { profile: UserBodyProfile; configured: boolean; enabled: boolean } {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return { profile: { ...DEFAULT_USER_PROFILE }, configured: false, enabled: false }
    }
    const parsed = JSON.parse(raw) as StoredProfile
    const profile = migrate(parsed as unknown as Record<string, unknown>)
    const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : true
    return { profile, configured: true, enabled }
  } catch {
    return { profile: { ...DEFAULT_USER_PROFILE }, configured: false, enabled: false }
  }
}

function persist(key: string, profile: UserBodyProfile, enabled: boolean) {
  const stored: StoredProfile = { ...profile, enabled }
  localStorage.setItem(key, JSON.stringify(stored))
}

export function useUserProfile() {
  const storageKey = useProfileScopedKey(LEGACY_KEY)
  const [profile, setProfileState] = useState<UserBodyProfile>(() => load(storageKey).profile)
  const [configured, setConfigured] = useState(() => load(storageKey).configured)
  const [enabled, setEnabledState] = useState(() => load(storageKey).enabled)

  useEffect(() => {
    const next = load(storageKey)
    setProfileState(next.profile)
    setConfigured(next.configured)
    setEnabledState(next.enabled)
  }, [storageKey])

  const setEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next)
      setConfigured(true)
      setProfileState((prev) => {
        persist(storageKey, prev, next)
        return prev
      })
    },
    [storageKey]
  )

  const setProfile = useCallback(
    (next: UserBodyProfile) => {
      setProfileState(next)
      setConfigured(true)
      setEnabledState((en) => {
        persist(storageKey, next, en)
        return en
      })
    },
    [storageKey]
  )

  const updateField = useCallback(
    <K extends keyof UserBodyProfile>(key: K, value: UserBodyProfile[K]) => {
      setConfigured(true)
      setProfileState((prev) => {
        const next = { ...prev, [key]: value }
        setEnabledState((en) => {
          persist(storageKey, next, en)
          return en
        })
        return next
      })
    },
    [storageKey]
  )

  return { profile, setProfile, updateField, configured, enabled, setEnabled }
}

export type { ActivityLevel, BodyGoal, Sex, UserBodyProfile }
