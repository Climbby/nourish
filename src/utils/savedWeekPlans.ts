/**
 * Named, reusable weekly plans — the "switch the brain off" mode.
 *
 * A saved plan is a whole week of slots under a name ("Semana Barata",
 * "Semana Proteína"). Pick one and 14 decisions collapse into one. The
 * per-slot suggestion engine stays for filling individual gaps.
 *
 * Plans accumulate: after a few weeks you have a library of weeks you already
 * know work, with real measured cost and macros behind them.
 *
 * A template is a **mould**, so unlike the live plan its slots stay relative:
 * absolute dates would make "Semana Barata" unusable the following week. The
 * live plan keys by date, a template keys by `dayOffset`, and applying one maps
 * offsets onto dates starting today.
 */

import {
  normalizeParts,
  todayIsoDate,
  type MealSlot,
  type PlannedSlot,
  type SlotPart,
} from '../hooks/usePlannedMeals'
import type { Recipe } from '../types/grocy'
import { addDays, diffDays, MAX_FUTURE_DAYS, parseIsoDate } from './planDates'
import { parseDescription } from './parseDescription'

/** A slot inside a template — relative to the day the plan gets applied. */
export interface TemplateSlot {
  /** 0 = the day the plan is applied. */
  dayOffset: number
  slot: MealSlot
  parts: SlotPart[]
}

/** Where dayOffset 0 lands when the plan is applied. */
export type WeekPlanAnchor = 'today' | 'sunday'

export interface SavedWeekPlan {
  id: string
  name: string
  description: string
  tags: string[]
  slots: TemplateSlot[]
  /**
   * Constructor plans are a Dom–Sáb mould (`sunday`). Plans captured from the
   * live rolling week stay relative to the day they are applied (`today`).
   */
  weekAnchor: WeekPlanAnchor
  /** ISO timestamps */
  createdAt: string
  updatedAt: string
}

export const MAX_SAVED_PLANS = 50

export function newPlanId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeTemplateSlot(raw: unknown): TemplateSlot | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (typeof s.dayOffset !== 'number' || s.dayOffset < 0) return null
  if (s.slot !== 'almoco' && s.slot !== 'jantar') return null

  // Dismissed slots were never worth storing in a mould.
  if (s.source === 'dismissed') return null

  const parts = normalizeParts(s.parts, s.recipeId)
  if (parts.length === 0) return null

  return { dayOffset: s.dayOffset, slot: s.slot, parts }
}

export function normalizeSavedPlan(raw: unknown): SavedWeekPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (typeof p.id !== 'string' || !p.id.trim()) return null
  if (typeof p.name !== 'string' || !p.name.trim()) return null

  const slots = Array.isArray(p.slots)
    ? p.slots.map(normalizeTemplateSlot).filter((s): s is TemplateSlot => s != null)
    : []

  const now = new Date().toISOString()
  return {
    id: p.id,
    name: p.name.trim(),
    description: typeof p.description === 'string' ? p.description.trim() : '',
    tags: Array.isArray(p.tags)
      ? p.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '').map((t) => t.trim())
      : [],
    slots,
    weekAnchor: p.weekAnchor === 'sunday' ? 'sunday' : 'today',
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : now,
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : now,
  }
}

export function parseSavedPlans(raw: string | null): SavedWeekPlan[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeSavedPlan).filter((p): p is SavedWeekPlan => p != null)
  } catch {
    return []
  }
}

/**
 * The slots a template can capture: today onward, with something in them.
 *
 * Past days are a record of what was eaten, not a mould to reuse, so they never
 * make it into a saved plan.
 */
export function savableSlots(slots: PlannedSlot[], today = todayIsoDate()): PlannedSlot[] {
  return slots.filter(
    (s) => s.date >= today && s.source !== 'dismissed' && s.parts.length > 0
  )
}

/** Build a template from the current plan, re-anchored so today becomes day 0. */
export function planFromSlots(
  name: string,
  description: string,
  tags: string[],
  slots: PlannedSlot[],
  today = todayIsoDate(),
  now = new Date()
): SavedWeekPlan {
  const iso = now.toISOString()
  return {
    id: newPlanId(),
    name: name.trim(),
    description: description.trim(),
    tags: tags.map((t) => t.trim()).filter(Boolean),
    slots: savableSlots(slots, today)
      .map((s) => ({
        dayOffset: diffDays(today, s.date),
        slot: s.slot,
        parts: s.parts.map((p) => ({ ...p })),
      }))
      .filter((s) => s.dayOffset < MAX_FUTURE_DAYS)
      .sort((a, b) => a.dayOffset - b.dayOffset),
    weekAnchor: 'today',
    createdAt: iso,
    updatedAt: iso,
  }
}

export function upsertPlan(plans: SavedWeekPlan[], plan: SavedWeekPlan): SavedWeekPlan[] {
  const idx = plans.findIndex((p) => p.id === plan.id)
  if (idx === -1) return [plan, ...plans].slice(0, MAX_SAVED_PLANS)
  const next = [...plans]
  next[idx] = { ...plan, updatedAt: new Date().toISOString() }
  return next
}

export function removePlan(plans: SavedWeekPlan[], id: string): SavedWeekPlan[] {
  return plans.filter((p) => p.id !== id)
}

/** Copy a plan under a new name, so a known-good week can be tweaked safely. */
export function clonePlan(plan: SavedWeekPlan, name: string, now = new Date()): SavedWeekPlan {
  const iso = now.toISOString()
  return {
    ...plan,
    id: newPlanId(),
    name: name.trim() || `${plan.name} (cópia)`,
    slots: plan.slots.map((s) => ({ ...s, parts: s.parts.map((p) => ({ ...p })) })),
    weekAnchor: plan.weekAnchor ?? 'today',
    createdAt: iso,
    updatedAt: iso,
  }
}

export interface PlanSummary {
  /** Slots that carry a prato. */
  meals: number
  /** How many different pratos the week uses — repetition is the point. */
  distinctPratos: number
  /** Summed [Preco] across every part, and how many carried one. */
  spend: number
  partsWithPrice: number
  /** Recipe ids in the plan that no longer exist in Grocy. */
  missingRecipeIds: number[]
}

export function summarizePlan(plan: SavedWeekPlan, recipes: Recipe[]): PlanSummary {
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const summary: PlanSummary = {
    meals: 0,
    distinctPratos: 0,
    spend: 0,
    partsWithPrice: 0,
    missingRecipeIds: [],
  }
  const pratos = new Set<number>()

  for (const slot of plan.slots) {
    if (slot.parts.some((p) => p.role === 'prato')) summary.meals++

    for (const part of slot.parts) {
      if (part.role === 'prato') pratos.add(part.recipeId)

      const recipe = byId.get(part.recipeId)
      if (!recipe) {
        if (!summary.missingRecipeIds.includes(part.recipeId)) {
          summary.missingRecipeIds.push(part.recipeId)
        }
        continue
      }
      const { price } = parseDescription(recipe.description ?? '')
      if (price !== null) {
        summary.spend += price
        summary.partsWithPrice++
      }
    }
  }

  summary.distinctPratos = pratos.size
  summary.spend = Math.round(summary.spend * 100) / 100
  return summary
}

/**
 * Drop parts whose recipe no longer exists, so applying a stale plan is safe.
 * Filtering is per part — losing the bebida must not throw away the prato.
 */
export function applicableSlots(plan: SavedWeekPlan, recipes: Recipe[]): TemplateSlot[] {
  const ids = new Set(recipes.map((r) => r.id))
  return plan.slots
    .map((s) => ({ ...s, parts: s.parts.filter((p) => ids.has(p.recipeId)) }))
    .filter((s) => s.parts.length > 0)
}

/** Where dayOffset 0 lands: today, or this week's Sunday. */
export function templateOriginDate(today: string, weekAnchor: WeekPlanAnchor = 'today'): string {
  if (weekAnchor !== 'sunday') return today
  return addDays(today, -parseIsoDate(today).getDay())
}

/**
 * Map a template onto real dates. Sunday-anchored plans skip days already in
 * the past; today-anchored plans start at `today` as offset 0.
 */
export function mapTemplateToDates(
  slots: TemplateSlot[],
  today: string,
  weekAnchor: WeekPlanAnchor = 'today'
): Array<{ date: string; slot: MealSlot; parts: SlotPart[] }> {
  const origin = templateOriginDate(today, weekAnchor)
  return slots
    .map((s) => ({
      date: addDays(origin, s.dayOffset),
      slot: s.slot,
      parts: s.parts,
    }))
    .filter((s) => s.date >= today)
}
