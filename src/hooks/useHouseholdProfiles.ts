import { useCallback, useEffect, useState } from 'react'
import {
  clearActiveProfileId,
  createProfileId,
  fetchHouseholdProfiles,
  getActiveProfileId,
  nextProfileColor,
  onActiveProfileChange,
  persistHouseholdProfiles,
  setActiveProfileId,
  type HouseholdProfile,
} from '../utils/householdProfiles'

export function useHouseholdProfiles() {
  const [profiles, setProfiles] = useState<HouseholdProfile[]>([])
  const [activeId, setActiveId] = useState<string | null>(() => getActiveProfileId())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchHouseholdProfiles()
      setProfiles(list)
      const current = getActiveProfileId()
      if (current && !list.some((p) => p.id === current)) {
        clearActiveProfileId()
        setActiveId(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => onActiveProfileChange(setActiveId), [])

  const activeProfile = profiles.find((p) => p.id === activeId) ?? null

  const selectProfile = useCallback((id: string) => {
    setActiveProfileId(id)
    setActiveId(id)
  }, [])

  const saveProfiles = useCallback(async (next: HouseholdProfile[]) => {
    setProfiles(next)
    await persistHouseholdProfiles(next)
  }, [])

  const renameProfile = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const next = profiles.map((p) => (p.id === id ? { ...p, name: trimmed } : p))
      await saveProfiles(next)
    },
    [profiles, saveProfiles]
  )

  const addProfile = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return null
      let id = createProfileId(trimmed)
      if (profiles.some((p) => p.id === id)) id = `${id}-${Date.now().toString(36).slice(-4)}`
      const profile: HouseholdProfile = {
        id,
        name: trimmed,
        color: nextProfileColor(profiles),
      }
      const next = [...profiles, profile]
      await saveProfiles(next)
      return profile
    },
    [profiles, saveProfiles]
  )

  return {
    profiles,
    activeId,
    activeProfile,
    loading,
    needsPicker: !loading && !activeId,
    selectProfile,
    renameProfile,
    addProfile,
    refresh,
  }
}
