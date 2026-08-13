import type { NutritionTargets } from '../hooks/useNutritionTargets'

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type BodyGoal = 'lose' | 'maintain' | 'gain'
export type HealthCondition = 'hipertensao' | 'diabetes' | 'colesterol' | 'gota' | 'renal'

export const HEALTH_CONDITIONS: HealthCondition[] = [
  'hipertensao',
  'diabetes',
  'colesterol',
  'gota',
  'renal',
]

export const HEALTH_CONDITION_LABELS: Record<HealthCondition, string> = {
  hipertensao: 'Tensão alta',
  diabetes: 'Diabetes',
  colesterol: 'Colesterol alto',
  gota: 'Gota',
  renal: 'Problemas renais',
}

export function isHealthCondition(value: unknown): value is HealthCondition {
  return typeof value === 'string' && (HEALTH_CONDITIONS as string[]).includes(value)
}

export interface UserBodyProfile {
  /** ISO date YYYY-MM-DD — age is derived */
  birthDate: string
  sex: Sex
  weightKg: number
  heightCm: number
  activity: ActivityLevel
  goal: BodyGoal
  conditions: HealthCondition[]
  /** Allergies and foods this person won't eat, free text. */
  dislikes: string
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentário',
  light: 'Ligeiro',
  moderate: 'Moderado',
  active: 'Activo',
  very_active: 'Muito activo',
}

export const GOAL_LABELS: Record<BodyGoal, string> = {
  lose: 'Perder peso',
  maintain: 'Manter',
  gain: 'Ganhar massa',
}

const ACTIVITY_MULT: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const GOAL_MULT: Record<BodyGoal, number> = {
  lose: 0.85,
  maintain: 1,
  gain: 1.12,
}

const PROTEIN_G_PER_KG: Record<BodyGoal, number> = {
  lose: 1.4,
  maintain: 1.0,
  gain: 1.7,
}

/** Approx. birth date for a given age (used when migrating old profiles). */
export function birthDateFromAge(age: number, now = new Date()): string {
  const y = now.getFullYear() - age
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function ageFromBirthDate(birthDate: string, now = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  if (!m) return 30
  const y = Number(m[1])
  const mo = Number(m[2])
  const day = Number(m[3])
  let age = now.getFullYear() - y
  const nowMd = (now.getMonth() + 1) * 100 + now.getDate()
  const birthMd = mo * 100 + day
  if (nowMd < birthMd) age -= 1
  return Math.max(0, Math.min(120, age))
}

export function profileAge(profile: UserBodyProfile, now = new Date()): number {
  return ageFromBirthDate(profile.birthDate, now)
}

export function bmrKcal(profile: UserBodyProfile): number {
  const { weightKg, heightCm, sex } = profile
  const age = profileAge(profile)
  if (sex === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161
}

/** Grams of protein per kg, after age and health adjustments. */
export function proteinPerKg(profile: UserBodyProfile): number {
  const conditions = profile.conditions ?? []

  // Impaired kidney function is the one case where a high-protein target is
  // actively wrong. Fall back to the RDA floor and let a doctor set the real one.
  if (conditions.includes('renal')) return 0.8

  const base = PROTEIN_G_PER_KG[profile.goal]

  // Older adults need more protein per kg, not less, to counter sarcopenia.
  if (profileAge(profile) >= 65) return Math.max(base, 1.2)

  return base
}

export function recommendedDailyTargets(profile: UserBodyProfile): NutritionTargets {
  const tdee = bmrKcal(profile) * ACTIVITY_MULT[profile.activity] * GOAL_MULT[profile.goal]
  const caloriesPerDay = Math.round(tdee)

  const proteinPerDay = Math.round(profile.weightKg * proteinPerKg(profile))
  const fatPerDay = Math.round((caloriesPerDay * 0.28) / 9)
  const proteinKcal = proteinPerDay * 4
  const fatKcal = fatPerDay * 9
  const carbsPerDay = Math.max(0, Math.round((caloriesPerDay - proteinKcal - fatKcal) / 4))

  return { caloriesPerDay, proteinPerDay, carbsPerDay, fatPerDay }
}

/**
 * Advisory notes driven by the declared health conditions. These are dietary
 * pointers, not medical advice — anything clinical belongs with a doctor.
 */
export function dietaryFlags(profile: UserBodyProfile): string[] {
  const conditions = profile.conditions ?? []
  const flags: string[] = []

  if (conditions.includes('renal')) {
    flags.push(
      'Proteína limitada a 0,8 g/kg por causa da função renal. O valor certo tem de ser definido por um médico.'
    )
  }
  if (conditions.includes('hipertensao')) {
    flags.push('Tensão alta: cortar sal e enchidos. Usa ervas, alho e limão para temperar.')
  }
  if (conditions.includes('diabetes')) {
    flags.push('Diabetes: preferir hidratos integrais e comê-los sempre com proteína, vegetais e gordura.')
  }
  if (conditions.includes('colesterol')) {
    flags.push('Colesterol: azeite como gordura principal, mais peixe e leguminosas, menos carne vermelha.')
  }
  if (conditions.includes('gota')) {
    flags.push('Gota: moderar vísceras, marisco e sardinha; beber bastante água.')
  }

  return flags
}

export function profileSummary(profile: UserBodyProfile, targets: NutritionTargets): string {
  return `${profileAge(profile)} anos · ${profile.weightKg} kg · ${ACTIVITY_LABELS[profile.activity]} · ${GOAL_LABELS[profile.goal]} → ~${targets.caloriesPerDay} kcal/dia`
}
