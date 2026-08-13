import { describe, expect, it } from 'vitest'
import {
  ageFromBirthDate,
  bmrKcal,
  birthDateFromAge,
  dietaryFlags,
  proteinPerKg,
  recommendedDailyTargets,
} from './nutritionRecommendations'
import { DEFAULT_USER_PROFILE } from '../hooks/useUserProfile'

describe('nutritionRecommendations', () => {
  it('computes higher calories for gain vs lose', () => {
    const maintain = recommendedDailyTargets({ ...DEFAULT_USER_PROFILE, goal: 'maintain' })
    const lose = recommendedDailyTargets({ ...DEFAULT_USER_PROFILE, goal: 'lose' })
    const gain = recommendedDailyTargets({ ...DEFAULT_USER_PROFILE, goal: 'gain' })
    expect(lose.caloriesPerDay).toBeLessThan(maintain.caloriesPerDay)
    expect(gain.caloriesPerDay).toBeGreaterThan(maintain.caloriesPerDay)
  })

  it('returns sensible BMR for adult male', () => {
    expect(bmrKcal(DEFAULT_USER_PROFILE)).toBeGreaterThan(1500)
    expect(bmrKcal(DEFAULT_USER_PROFILE)).toBeLessThan(2200)
  })

  it('derives age from birth date', () => {
    expect(ageFromBirthDate('2000-01-01', new Date('2026-07-19'))).toBe(26)
    expect(ageFromBirthDate('2000-12-31', new Date('2026-07-19'))).toBe(25)
  })
})

describe('protein targets and health conditions', () => {
  it('caps protein at the RDA floor when kidney function is impaired', () => {
    const profile = { ...DEFAULT_USER_PROFILE, goal: 'gain' as const, conditions: ['renal' as const] }
    expect(proteinPerKg(profile)).toBe(0.8)
    expect(recommendedDailyTargets(profile).proteinPerDay).toBe(Math.round(profile.weightKg * 0.8))
  })

  it('raises the protein floor for adults 65 and over', () => {
    const older = { ...DEFAULT_USER_PROFILE, birthDate: birthDateFromAge(70), goal: 'maintain' as const }
    const younger = { ...DEFAULT_USER_PROFILE, birthDate: birthDateFromAge(30), goal: 'maintain' as const }
    expect(proteinPerKg(older)).toBe(1.2)
    expect(proteinPerKg(older)).toBeGreaterThan(proteinPerKg(younger))
  })

  it('does not lower an already-higher goal target for older adults', () => {
    const older = { ...DEFAULT_USER_PROFILE, birthDate: birthDateFromAge(70), goal: 'gain' as const }
    expect(proteinPerKg(older)).toBe(1.7)
  })

  it('renal overrides the age floor', () => {
    const profile = {
      ...DEFAULT_USER_PROFILE,
      birthDate: birthDateFromAge(70),
      conditions: ['renal' as const],
    }
    expect(proteinPerKg(profile)).toBe(0.8)
  })

  it('surfaces one advisory flag per declared condition', () => {
    expect(dietaryFlags(DEFAULT_USER_PROFILE)).toEqual([])
    const flags = dietaryFlags({
      ...DEFAULT_USER_PROFILE,
      conditions: ['hipertensao', 'diabetes'],
    })
    expect(flags).toHaveLength(2)
    expect(flags.join(' ')).toMatch(/sal/i)
  })

  it('tolerates profiles saved before conditions existed', () => {
    const legacy = { ...DEFAULT_USER_PROFILE } as Record<string, unknown>
    delete legacy.conditions
    const profile = legacy as unknown as typeof DEFAULT_USER_PROFILE
    expect(() => proteinPerKg(profile)).not.toThrow()
    expect(dietaryFlags(profile)).toEqual([])
  })
})
