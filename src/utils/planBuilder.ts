/**
 * Manual Dom–Sáb week builder for saved plans.
 *
 * The live plan is a rolling window from today. The builder is a week *shape*
 * (Sunday → Saturday) — weekday names only, no calendar dates. On save, picks
 * become a Sunday-anchored template. Applying maps Sunday onto that week's
 * Sunday, skipping days already in the past.
 */

import {
  type MealSlot,
  type PlannedSlot,
} from '../hooks/usePlannedMeals'
import type { SuggestionPreference } from './suggestMeal'
import { addDays, parseIsoDate } from './planDates'
import {
  newPlanId,
  type SavedWeekPlan,
  type TemplateSlot,
} from './savedWeekPlans'
import { MACRO_LABEL, type NutritionGap } from './weeklyNutritionPlan'
import { MEAL_SLOTS } from './weekPlanSlots'

export const BUILDER_WEEKDAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const

export const BUILDER_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const
export type BuilderWeekday = (typeof BUILDER_WEEKDAYS)[number]

/** `${weekday}:${slot}` → Completa recipe id. Weekday is 0 = Sunday. */
export type BuilderPicks = Record<string, number>

export function weekSunday(iso: string): string {
  const day = parseIsoDate(iso).getDay()
  return addDays(iso, -day)
}

/** Calendar week containing `today`, Sunday through Saturday — apply/suggest only. */
export function builderWeekDates(today: string): string[] {
  const sun = weekSunday(today)
  return Array.from({ length: 7 }, (_, i) => addDays(sun, i))
}

export function builderPickKey(weekday: number, slot: MealSlot): string {
  return `${weekday}:${slot}`
}

export function getPick(picks: BuilderPicks, weekday: number, slot: MealSlot): number | null {
  return picks[builderPickKey(weekday, slot)] ?? null
}

export function setPick(
  picks: BuilderPicks,
  weekday: number,
  slot: MealSlot,
  recipeId: number | null
): BuilderPicks {
  const key = builderPickKey(weekday, slot)
  if (recipeId == null) {
    if (!(key in picks)) return picks
    const next = { ...picks }
    delete next[key]
    return next
  }
  if (picks[key] === recipeId) return picks
  return { ...picks, [key]: recipeId }
}

/**
 * Consecutive weekdays from `weekday` (inclusive) that share the same recipe
 * for `slot`. 0 when the slot is empty.
 */
export function mealSpanAt(
  picks: BuilderPicks,
  weekday: number,
  slot: MealSlot
): number {
  const recipeId = getPick(picks, weekday, slot)
  if (recipeId == null) return 0
  if (weekday < 0 || weekday > 6) return 0
  let span = 1
  for (let i = weekday + 1; i <= 6; i++) {
    if (getPick(picks, i, slot) !== recipeId) break
    span++
  }
  return span
}

/** First day of a same-meal run — only the head shows the span +/- control. */
export function isSpanHead(picks: BuilderPicks, weekday: number, slot: MealSlot): boolean {
  const recipeId = getPick(picks, weekday, slot)
  if (recipeId == null) return false
  if (weekday <= 0) return true
  return getPick(picks, weekday - 1, slot) !== recipeId
}

/**
 * Place `recipeId` on `spanDays` consecutive weekdays starting at `weekday`.
 * Clears any previous same-recipe run that started at `weekday` beyond the new span.
 */
export function setMealSpan(
  picks: BuilderPicks,
  weekday: number,
  slot: MealSlot,
  recipeId: number,
  spanDays: number
): BuilderPicks {
  if (weekday < 0 || weekday > 6) return picks
  const maxSpan = 7 - weekday
  const span = Math.max(1, Math.min(Math.floor(spanDays), maxSpan))

  const oldId = getPick(picks, weekday, slot)
  const next = { ...picks }

  if (oldId != null) {
    for (let i = weekday; i <= 6; i++) {
      if (getPick(picks, i, slot) !== oldId) break
      delete next[builderPickKey(i, slot)]
    }
  }

  for (let i = 0; i < span; i++) {
    next[builderPickKey(weekday + i, slot)] = recipeId
  }
  return next
}

/** Copy the previous weekday's meal into this day's slot (no-op if none). */
export function repeatPreviousDay(
  picks: BuilderPicks,
  weekday: number,
  slot: MealSlot
): BuilderPicks {
  if (weekday <= 0) return picks
  const prev = getPick(picks, weekday - 1, slot)
  if (prev == null) return picks
  return setPick(picks, weekday, slot, prev)
}

/**
 * Clear a slot. If it is the head of a multi-day run, clear the whole run so
 * "remove" doesn't leave orphan copies.
 */
export function clearMealRun(
  picks: BuilderPicks,
  weekday: number,
  slot: MealSlot
): BuilderPicks {
  const recipeId = getPick(picks, weekday, slot)
  if (recipeId == null) return picks
  if (!isSpanHead(picks, weekday, slot)) {
    return setPick(picks, weekday, slot, null)
  }
  const span = mealSpanAt(picks, weekday, slot)
  const next = { ...picks }
  for (let i = 0; i < span; i++) {
    delete next[builderPickKey(weekday + i, slot)]
  }
  return next
}

/** Map weekday picks onto a real Sunday–Saturday for the suggestion engine / apply. */
export function picksToPlannedSlots(picks: BuilderPicks, sunday: string): PlannedSlot[] {
  const out: PlannedSlot[] = []
  for (const weekday of BUILDER_WEEKDAYS) {
    for (const slot of MEAL_SLOTS) {
      const recipeId = getPick(picks, weekday, slot)
      if (recipeId == null) continue
      out.push({
        date: addDays(sunday, weekday),
        slot,
        parts: [{ role: 'prato', recipeId }],
        source: 'chosen',
      })
    }
  }
  return out
}

function suggestionWeekday(key: string, sunday: string): { weekday: number; slot: MealSlot } | null {
  const idx = key.lastIndexOf(':')
  if (idx < 0) return null
  const date = key.slice(0, idx)
  const slot = key.slice(idx + 1) as MealSlot
  if (slot !== 'almoco' && slot !== 'jantar') return null
  const weekday = parseIsoDate(date).getDay()
  if (addDays(sunday, weekday) !== date) return null
  return { weekday, slot }
}

/** Fill empty weekday slots from a suggestion map; leave manual picks alone. */
export function mergeSuggestionsIntoPicks(
  picks: BuilderPicks,
  suggestions: Map<string, number>,
  sunday: string
): BuilderPicks {
  let next = picks
  for (const [key, id] of suggestions) {
    const parsed = suggestionWeekday(key, sunday)
    if (!parsed) continue
    const pickKey = builderPickKey(parsed.weekday, parsed.slot)
    if (next[pickKey] != null) continue
    if (next === picks) next = { ...picks }
    next[pickKey] = id
  }
  return next
}

export function countFilledSlots(picks: BuilderPicks): number {
  let n = 0
  for (const weekday of BUILDER_WEEKDAYS) {
    for (const slot of MEAL_SLOTS) {
      if (getPick(picks, weekday, slot) != null) n++
    }
  }
  return n
}

/** Distinct weekdays that already have a prato — days the objectivos check averages over. */
export function countFilledDays(picks: BuilderPicks): number {
  let n = 0
  for (const weekday of BUILDER_WEEKDAYS) {
    if (MEAL_SLOTS.some((slot) => getPick(picks, weekday, slot) != null)) n++
  }
  return n
}

export function picksToTemplateSlots(picks: BuilderPicks): TemplateSlot[] {
  const slots: TemplateSlot[] = []
  for (const weekday of BUILDER_WEEKDAYS) {
    for (const slot of MEAL_SLOTS) {
      const recipeId = getPick(picks, weekday, slot)
      if (recipeId == null) continue
      slots.push({
        dayOffset: weekday,
        slot,
        parts: [{ role: 'prato', recipeId }],
      })
    }
  }
  return slots
}

export function saveBuilderPlan(
  name: string,
  description: string,
  tags: string[],
  picks: BuilderPicks,
  now = new Date()
): SavedWeekPlan {
  const iso = now.toISOString()
  return {
    id: newPlanId(),
    name: name.trim(),
    description: description.trim(),
    tags: tags.map((t) => t.trim()).filter(Boolean),
    slots: picksToTemplateSlots(picks),
    weekAnchor: 'sunday',
    createdAt: iso,
    updatedAt: iso,
  }
}

/**
 * When objectivos are off, Nutritivo must not drive the fill — Preferidos (or
 * Barato if that's already selected) is the fallback.
 */
export function builderSuggestionPreference(
  honorTargets: boolean,
  preference: SuggestionPreference
): SuggestionPreference {
  if (!honorTargets && preference === 'balanced') return 'taste'
  return preference
}

/** Portuguese warning when a constructed week misses objectivos. `null` if it meets them. */
export function builderObjectivesWarning(gaps: NutritionGap[]): string | null {
  if (gaps.length === 0) return null
  const labels = gaps.map((g) => MACRO_LABEL[g.key].toLowerCase())
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
  return `A semana está abaixo em ${list}. Toca para ignorar os objectivos.`
}
