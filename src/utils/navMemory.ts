const KEYS = {
  plan: 'nourish-last-plan',
  meals: 'nourish-last-meals',
  profile: 'nourish-last-profile',
} as const

export type NavSection = keyof typeof KEYS

const FALLBACK: Record<NavSection, string> = {
  plan: '/plan',
  meals: '/meals',
  profile: '/profile',
}

export function getLastNavPath(section: NavSection): string {
  try {
    const raw = localStorage.getItem(KEYS[section])
    if (!raw || !raw.startsWith(FALLBACK[section])) return FALLBACK[section]
    return raw
  } catch {
    return FALLBACK[section]
  }
}

export function rememberNavPath(section: NavSection, path: string): void {
  try {
    if (!path.startsWith(FALLBACK[section])) return
    localStorage.setItem(KEYS[section], path)
  } catch {
    /* ignore quota / private mode */
  }
}
