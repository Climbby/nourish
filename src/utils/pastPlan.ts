/**
 * The past half of the plan.
 *
 * Today and the future are a *plan* and live in localStorage. Yesterday and
 * before are a *record* and live in Grocy's `meal_plan`. The days below the
 * separator are the union of the two: a slot left over from planning shows what
 * was intended, an entry in `meal_plan` shows what was actually eaten, and a
 * part with both carries the ✓.
 */

import type { MealSlot, PlannedSlot, SlotPart } from '../hooks/usePlannedMeals'
import type { MealPlanEntry } from '../types/grocy'
import { currentMealSlot } from './logMealConsumption'
import { mealLogSlot } from './mealLogAttribution'
import type { PartRole } from './mealRole'
import { pruneCutoff, PAST_WINDOW_DAYS } from './planDates'

/**
 * Which meal a logged entry belongs to.
 *
 * `meal_plan` has no column for it, so newer entries carry the mark in their
 * note. Older ones predate the mark and only leave the write time as evidence —
 * lunch if it was written before 15:00.
 */
export function entryMealSlot(entry: MealPlanEntry): MealSlot {
  const marked = mealLogSlot(entry.note)
  if (marked) return marked

  const stamp = entry.row_created_timestamp
  if (stamp) {
    const written = new Date(stamp.replace(' ', 'T'))
    if (!Number.isNaN(written.getTime())) return currentMealSlot(written)
  }
  return 'almoco'
}

export interface PastSlotView {
  date: string
  slot: MealSlot
  parts: SlotPart[]
  /** Recipe ids with a `meal_plan` entry — these are the ones that get the ✓. */
  logged: Set<number>
  /** Entry id per recipe, so removing a chip can delete the record it came from. */
  entryIdByRecipe: Map<number, number>
}

function emptyView(date: string, slot: MealSlot): PastSlotView {
  return { date, slot, parts: [], logged: new Set(), entryIdByRecipe: new Map() }
}

/**
 * Put a recipe in its role, resolving the case where the role is taken.
 *
 * A logged recipe displaces a merely-planned one: if the plan said Bitoque and
 * the record says Bacalhau, what got eaten was Bacalhau. Two logged recipes
 * competing for one role is the one case that cannot be drawn — the later one
 * keeps its ✓ in `logged` but yields the chip.
 */
function place(view: PastSlotView, role: PartRole, recipeId: number, isLogged: boolean): void {
  const existing = view.parts.find((p) => p.role === role)
  if (!existing) {
    view.parts.push({ role, recipeId })
    return
  }
  if (existing.recipeId === recipeId) return
  if (isLogged && !view.logged.has(existing.recipeId)) {
    existing.recipeId = recipeId
  }
}

/**
 * Build the past days, newest first.
 *
 * Only days holding something are returned: seven empty rows under today would
 * say nothing, so the record grows on its own as meals get eaten.
 */
export function buildPastSlots(
  planned: PlannedSlot[],
  entries: MealPlanEntry[],
  roleOf: (recipeId: number) => PartRole | null,
  today: string,
  pastWindow = PAST_WINDOW_DAYS
): PastSlotView[] {
  const cutoff = pruneCutoff(today, pastWindow)
  const byKey = new Map<string, PastSlotView>()

  const viewFor = (date: string, slot: MealSlot): PastSlotView => {
    const key = `${date}:${slot}`
    const existing = byKey.get(key)
    if (existing) return existing
    const created = emptyView(date, slot)
    byKey.set(key, created)
    return created
  }

  for (const slot of planned) {
    if (slot.date >= today || slot.date < cutoff) continue
    if (slot.source === 'dismissed' || slot.parts.length === 0) continue
    const view = viewFor(slot.date, slot.slot)
    for (const part of slot.parts) place(view, part.role, part.recipeId, false)
  }

  // Chronological, so the earliest log wins a contested role.
  const ordered = [...entries]
    .filter((e) => e.day < today && e.day >= cutoff)
    .sort((a, b) => a.id - b.id)

  for (const entry of ordered) {
    const view = viewFor(entry.day, entryMealSlot(entry))
    view.logged.add(entry.recipe_id)
    view.entryIdByRecipe.set(entry.recipe_id, entry.id)
    // A recipe with no part role — a `Ligeira`, say — was still the meal. The
    // rule that keeps `Ligeira` out of a prato governs planning, not recording.
    place(view, roleOf(entry.recipe_id) ?? 'prato', entry.recipe_id, true)
  }

  return [...byKey.values()].sort((a, b) =>
    a.date === b.date ? (a.slot === 'almoco' ? -1 : 1) : b.date.localeCompare(a.date)
  )
}

/** The merged past, shaped so the rest of the plan machinery can read it. */
export function pastSlotsAsPlanned(views: PastSlotView[]): PlannedSlot[] {
  return views.map((v) => ({
    date: v.date,
    slot: v.slot,
    parts: v.parts.map((p) => ({ ...p })),
    source: 'chosen' as const,
  }))
}
