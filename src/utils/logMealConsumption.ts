import { grocy } from '../api/grocy'
import { todayIsoDate } from '../hooks/usePlannedMeals'
import { splayMealAccess } from './mealAccess'
import { decrementPortions } from './buildDescription'
import { parseDescription } from './parseDescription'

export interface LogMealResult {
  description: string
}

/** Log that the meal was eaten today: meal_plan entry, optional portion decrement, splay order. */
export async function logMealConsumption(
  recipeId: number,
  description: string
): Promise<LogMealResult> {
  const day = todayIsoDate()
  const shouldDecrement = (parseDescription(description).portions ?? 0) > 0
  let nextDesc = description
  let decremented = false

  try {
    if (shouldDecrement) {
      nextDesc = decrementPortions(description)
      await grocy.updateRecipe(recipeId, { description: nextDesc })
      decremented = true
    }
    await grocy.logMeal({ day, recipe_id: recipeId, note: '' })
    splayMealAccess(recipeId)
    return { description: nextDesc }
  } catch (e) {
    if (decremented) {
      try {
        await grocy.updateRecipe(recipeId, { description })
      } catch {
        /* rollback failed — portions may be out of sync */
      }
    }
    throw e
  }
}

export type MealSlotByTime = 'almoco' | 'jantar'

/** Before 15:00 → almoço; from 15:00 → jantar. */
export function currentMealSlot(date = new Date()): MealSlotByTime {
  return date.getHours() < 15 ? 'almoco' : 'jantar'
}
