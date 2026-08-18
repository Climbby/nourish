export interface HouseholdProfile {
  id: string
  name: string
  color: string
}

export const DEFAULT_HOUSEHOLD_PROFILES: HouseholdProfile[] = [
  { id: 'francisco', name: 'Francisco', color: '#2dd4bf' },
  { id: 'pai', name: 'Pai', color: '#f59e0b' },
]

const ACTIVE_KEY = 'nourish-active-profile'
const PROFILE_CHANGE_EVENT = 'nourish-active-profile-change'

const LEGACY_PREF_KEYS = [
  'nourish-user-profile',
  'nourish-nutrition-targets',
  'nourish-display-prefs',
  'nourish-favourites',
  'nourish-planned-slots',
  'nourish-suggestion-preference',
  'nourish-suggestion-salt',
  'nourish-plan-origins',
  'nourish-meal-access-order',
] as const

export function getActiveProfileId(): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    return raw && raw.trim() ? raw.trim() : null
  } catch {
    return null
  }
}

export function profileScopedKey(legacyKey: string, profileId?: string | null): string {
  const id = profileId ?? getActiveProfileId()
  if (!id) return legacyKey
  const suffix = legacyKey.startsWith('nourish-') ? legacyKey.slice('nourish-'.length) : legacyKey
  return `nourish:${id}:${suffix}`
}

/** Copy unprefixed legacy prefs into a profile namespace once. */
export function migrateLegacyPrefsIntoProfile(profileId: string): void {
  try {
    for (const legacy of LEGACY_PREF_KEYS) {
      const scoped = profileScopedKey(legacy, profileId)
      if (localStorage.getItem(scoped) != null) continue
      const raw = localStorage.getItem(legacy)
      if (raw != null) localStorage.setItem(scoped, raw)
    }
  } catch {
    /* ignore */
  }
}

export function setActiveProfileId(profileId: string): void {
  migrateLegacyPrefsIntoProfile(profileId)
  localStorage.setItem(ACTIVE_KEY, profileId)
  window.dispatchEvent(new CustomEvent(PROFILE_CHANGE_EVENT, { detail: profileId }))
}

export function clearActiveProfileId(): void {
  localStorage.removeItem(ACTIVE_KEY)
  window.dispatchEvent(new CustomEvent(PROFILE_CHANGE_EVENT, { detail: null }))
}

export function onActiveProfileChange(cb: (profileId: string | null) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<string | null>).detail
    cb(detail ?? getActiveProfileId())
  }
  window.addEventListener(PROFILE_CHANGE_EVENT, handler)
  return () => window.removeEventListener(PROFILE_CHANGE_EVENT, handler)
}

export async function fetchHouseholdProfiles(): Promise<HouseholdProfile[]> {
  try {
    const res = await fetch('/nourish/profiles', { cache: 'no-store' })
    if (!res.ok) return [...DEFAULT_HOUSEHOLD_PROFILES]
    const data = (await res.json()) as { profiles?: HouseholdProfile[] }
    const list = Array.isArray(data.profiles) ? data.profiles : []
    return list.length > 0 ? list : [...DEFAULT_HOUSEHOLD_PROFILES]
  } catch {
    return [...DEFAULT_HOUSEHOLD_PROFILES]
  }
}

export async function persistHouseholdProfiles(profiles: HouseholdProfile[]): Promise<void> {
  try {
    await fetch('/nourish/profiles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profiles }),
    })
  } catch {
    /* offline — profiles still usable from last GET / defaults */
  }
}

export function createProfileId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || `perfil-${Date.now().toString(36)}`
}

const PROFILE_COLORS = ['#2dd4bf', '#f59e0b', '#60a5fa', '#f472b6', '#a78bfa', '#34d399']

export function nextProfileColor(existing: HouseholdProfile[]): string {
  const used = new Set(existing.map((p) => p.color))
  return PROFILE_COLORS.find((c) => !used.has(c)) ?? PROFILE_COLORS[existing.length % PROFILE_COLORS.length]
}
