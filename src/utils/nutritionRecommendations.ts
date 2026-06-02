import type { NutritionTargets } from '../hooks/useNutritionTargets'

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type BodyGoal = 'lose' | 'maintain' | 'gain'

export interface UserBodyProfile {
  age: number
  sex: Sex
  weightKg: number
  heightCm: number
  activity: ActivityLevel
  goal: BodyGoal
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

export function bmrKcal(profile: UserBodyProfile): number {
  const { weightKg, heightCm, age, sex } = profile
  if (sex === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161
}

export function recommendedDailyTargets(profile: UserBodyProfile): NutritionTargets {
  const tdee = bmrKcal(profile) * ACTIVITY_MULT[profile.activity] * GOAL_MULT[profile.goal]
  const caloriesPerDay = Math.round(tdee)

  const proteinPerDay = Math.round(profile.weightKg * PROTEIN_G_PER_KG[profile.goal])
  const fatPerDay = Math.round((caloriesPerDay * 0.28) / 9)
  const proteinKcal = proteinPerDay * 4
  const fatKcal = fatPerDay * 9
  const carbsPerDay = Math.max(0, Math.round((caloriesPerDay - proteinKcal - fatKcal) / 4))

  return { caloriesPerDay, proteinPerDay, carbsPerDay, fatPerDay }
}

export function profileSummary(profile: UserBodyProfile, targets: NutritionTargets): string {
  return `${profile.age} anos · ${profile.weightKg} kg · ${ACTIVITY_LABELS[profile.activity]} · ${GOAL_LABELS[profile.goal]} → ~${targets.caloriesPerDay} kcal/dia`
}
