import { describe, expect, it } from 'vitest'
import { bmrKcal, recommendedDailyTargets } from './nutritionRecommendations'
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
})
