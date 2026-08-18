import { profileScopedKey } from './householdProfiles'

const LEGACY_KEY = 'nourish-suggestion-salt'

function randomSalt(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return (buf[0] || 1) >>> 0
  }
  return ((Math.random() * 0xffffffff) >>> 0) || 1
}

export function loadSuggestionSalt(): number {
  try {
    const raw = localStorage.getItem(profileScopedKey(LEGACY_KEY))
    const n = raw != null ? Number(raw) : NaN
    if (Number.isFinite(n) && n !== 0) return n >>> 0
  } catch {
    /* ignore */
  }
  const salt = randomSalt()
  saveSuggestionSalt(salt)
  return salt
}

export function saveSuggestionSalt(salt: number): void {
  try {
    localStorage.setItem(profileScopedKey(LEGACY_KEY), String(salt >>> 0))
  } catch {
    /* ignore */
  }
}

/** New sequence the next time suggestions are built (clear / apply a saved plan). */
export function rotateSuggestionSalt(): number {
  const salt = randomSalt()
  saveSuggestionSalt(salt)
  return salt
}
