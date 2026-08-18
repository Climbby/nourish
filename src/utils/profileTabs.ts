export type ProfileTab = 'resumo' | 'objectivos' | 'definicoes'

export const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'definicoes', label: 'Definições' },
  { key: 'objectivos', label: 'Objectivos' },
  { key: 'resumo', label: 'Resumo' },
]

export function parseProfileTab(raw: string | null | undefined): ProfileTab {
  if (raw === 'resumo') return 'resumo'
  // Legacy deep-link from VisitCarSheet
  if (raw === 'objectivos' || raw === 'viaturas') return 'objectivos'
  return 'definicoes'
}

export function profilePathForTab(tab: ProfileTab): string {
  return tab === 'definicoes' ? '/profile' : `/profile?tab=${tab}`
}

export function visibleProfileTabs(showResumo: boolean): typeof PROFILE_TABS {
  return PROFILE_TABS.filter((t) => t.key !== 'resumo' || showResumo)
}

export interface ResumoContentInput {
  /** Macros/kcal bars are shown (objectivos or dados pessoais, and not hidden). */
  nutritionActive: boolean
  /** Logged meals attributed to the active profile in the lookback window. */
  mealsLogged: number
  /** Display pref allows € on Resumo spend cards. */
  showPrices: boolean
  shoppingEur: number
  fuelEur: number
  /** Attributed supermarket visits in the lookback window. */
  visitCount: number
}

/**
 * True when Perfil → Resumo would show more than the period heading.
 * Empty = no nutrient bars with meals, and no spend/visits for this profile.
 */
export function resumoHasContent(input: ResumoContentInput): boolean {
  if (input.nutritionActive && input.mealsLogged > 0) return true
  if (
    input.showPrices &&
    (input.shoppingEur > 0 || input.fuelEur > 0 || input.visitCount > 0)
  ) {
    return true
  }
  return false
}
