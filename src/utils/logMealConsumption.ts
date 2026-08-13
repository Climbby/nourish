import { grocy } from '../api/grocy'
import { todayIsoDate, type SlotPart } from '../hooks/usePlannedMeals'
import type { Recipe } from '../types/grocy'
import { splayMealAccess } from './mealAccess'
import { decrementPortions } from './buildDescription'
import { getActiveProfileId } from './householdProfiles'
import { encodeMealLogNote } from './mealLogAttribution'
import { ROLE_ORDER, type PartRole } from './mealRole'
import { parseDescription } from './parseDescription'

export interface LogMealResult {
  description: string
}

export interface LogMealOptions {
  /** Defaults to today. A past date puts the record on the day it belongs to. */
  day?: string
  /** Which meal of the day; defaults to what the clock says right now. */
  slot?: MealSlotByTime
}

/** Log that the meal was eaten: meal_plan entry, optional portion decrement, splay order. */
export async function logMealConsumption(
  recipeId: number,
  description: string,
  options: LogMealOptions = {}
): Promise<LogMealResult> {
  const day = options.day ?? todayIsoDate()
  const shouldDecrement = (parseDescription(description).portions ?? 0) > 0
  let nextDesc = description
  let decremented = false
  const note = encodeMealLogNote({
    owner: getActiveProfileId(),
    share: true,
    slot: options.slot ?? currentMealSlot(),
  })

  try {
    if (shouldDecrement) {
      nextDesc = decrementPortions(description)
      await grocy.updateRecipe(recipeId, { description: nextDesc })
      decremented = true
    }
    await grocy.logMeal({ day, recipe_id: recipeId, note })
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

export interface SlotLogResult {
  /** Recipes whose stored description changed, so the caller can refresh them. */
  updated: { recipeId: number; description: string }[]
  /** Parts that could not be logged, named so the message can say which. */
  failed: { role: PartRole; name: string }[]
}

/**
 * Log a whole meal — sopa, prato, sobremesa and bebida — one part at a time.
 *
 * Sequential rather than parallel so each part keeps its own portion rollback,
 * and so a failure halfway leaves a record of exactly what did go through. The
 * caller gets the failures back by name: "Erro" alone would leave you guessing
 * which part to retry.
 */
export async function logSlotConsumption(
  parts: SlotPart[],
  recipeById: Map<number, Recipe>,
  options: LogMealOptions = {}
): Promise<SlotLogResult> {
  const updated: SlotLogResult['updated'] = []
  const failed: SlotLogResult['failed'] = []

  const ordered = [...parts].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  )

  for (const part of ordered) {
    const recipe = recipeById.get(part.recipeId)
    if (!recipe) continue
    try {
      const { description } = await logMealConsumption(
        recipe.id,
        recipe.description ?? '',
        options
      )
      if (description !== recipe.description) {
        updated.push({ recipeId: recipe.id, description })
      }
    } catch {
      failed.push({ role: part.role, name: recipe.name })
    }
  }

  return { updated, failed }
}

export type MealSlotByTime = 'almoco' | 'jantar'

/** Before 15:00 → almoço; from 15:00 → jantar. */
export function currentMealSlot(date = new Date()): MealSlotByTime {
  return date.getHours() < 15 ? 'almoco' : 'jantar'
}
