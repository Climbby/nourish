import { useCallback, useEffect, useState } from 'react'
import { useProfileScopedKey } from './useProfileScopedKey'
import { isPartRole, ROLE_ORDER, type PartRole } from '../utils/mealRole'
import {
  addDays,
  isoDate,
  isValidIsoDate,
  pruneCutoff,
} from '../utils/planDates'

const LEGACY_KEY = 'nourish-planned-slots'

export type MealSlot = 'almoco' | 'jantar'
export type SlotSource = 'accepted' | 'chosen' | 'dismissed'

/** One component of a meal — at most one per role in a slot. */
export interface SlotPart {
  role: PartRole
  recipeId: number
}

export interface PlannedSlot {
  /** ISO `yyyy-mm-dd`, absolute. Never an offset from today. */
  date: string
  slot: MealSlot
  /** Empty ⟺ the slot was dismissed. */
  parts: SlotPart[]
  /** How the prato got there. */
  source: SlotSource
}

interface StoredPlan {
  slots: PlannedSlot[]
}

export function todayIsoDate(date = new Date()): string {
  return isoDate(date)
}

export function slotKey(date: string, slot: MealSlot): string {
  return `${date}:${slot}`
}

/** The recipe filling a given role, or null. */
export function slotPart(slot: PlannedSlot | undefined, role: PartRole): number | null {
  return slot?.parts.find((p) => p.role === role)?.recipeId ?? null
}

export function slotPrato(slot: PlannedSlot | undefined): number | null {
  return slotPart(slot, 'prato')
}

/**
 * A slot counts as a decided meal only when it has a prato. A slot holding just
 * a drink is not a meal — for suggestions, for totals, or for revealing the
 * next day.
 */
export function slotHasMeal(slot: PlannedSlot | undefined): slot is PlannedSlot {
  return slot != null && slot.source !== 'dismissed' && slotPrato(slot) !== null
}

/** Every recipe id in a slot, in serving order. */
export function slotRecipeIds(slot: PlannedSlot | undefined): number[] {
  if (!slot) return []
  return ROLE_ORDER.map((role) => slotPart(slot, role)).filter(
    (id): id is number => id !== null
  )
}

function normalizePart(raw: unknown): SlotPart | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (!isPartRole(p.role)) return null
  if (typeof p.recipeId !== 'number' || !Number.isFinite(p.recipeId)) return null
  return { role: p.role, recipeId: p.recipeId }
}

function dedupeParts(parts: SlotPart[]): SlotPart[] {
  const byRole = new Map<PartRole, SlotPart>()
  for (const part of parts) byRole.set(part.role, part)
  return ROLE_ORDER.map((role) => byRole.get(role)).filter((p): p is SlotPart => p != null)
}

/**
 * Read a slot's parts from either shape: the `parts` array, or a legacy single
 * `recipeId` that becomes the prato. Shared with the saved-plan normalizer so
 * both migrate identically.
 */
export function normalizeParts(rawParts: unknown, legacyRecipeId?: unknown): SlotPart[] {
  if (Array.isArray(rawParts)) {
    return dedupeParts(rawParts.map(normalizePart).filter((p): p is SlotPart => p != null))
  }
  if (typeof legacyRecipeId === 'number' && Number.isFinite(legacyRecipeId)) {
    return [{ role: 'prato', recipeId: legacyRecipeId }]
  }
  return []
}

/**
 * Accepts both shapes.
 *
 * Legacy slots are `{ dayOffset, slot, recipeId, source }` and need the stored
 * `weekStart` to become absolute; the single recipe becomes the prato.
 */
export function normalizeSlot(raw: unknown, legacyAnchor?: string): PlannedSlot | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (s.slot !== 'almoco' && s.slot !== 'jantar') return null

  let date: string | null = null
  if (isValidIsoDate(s.date)) {
    date = s.date
  } else if (typeof s.dayOffset === 'number' && legacyAnchor && isValidIsoDate(legacyAnchor)) {
    date = addDays(legacyAnchor, s.dayOffset)
  }
  if (date === null) return null

  if (s.source === 'dismissed') {
    return { date, slot: s.slot, parts: [], source: 'dismissed' }
  }
  if (s.source !== 'accepted' && s.source !== 'chosen') return null

  const parts = normalizeParts(s.parts, s.recipeId)
  if (parts.length === 0) return null

  return { date, slot: s.slot, parts, source: s.source }
}

/** Last slot wins per (date, slot), and anything past the window is dropped. */
function reconcile(slots: PlannedSlot[], today: string): PlannedSlot[] {
  const cutoff = pruneCutoff(today)
  const byKey = new Map<string, PlannedSlot>()
  for (const slot of slots) {
    if (slot.date < cutoff) continue
    byKey.set(slotKey(slot.date, slot.slot), slot)
  }
  return [...byKey.values()]
}

export function load(key: string, today = todayIsoDate()): StoredPlan {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { slots: [] }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || !Array.isArray(parsed.slots)) return { slots: [] }

    // Pre-migration plans anchored their offsets on weekStart.
    const anchor = typeof parsed.weekStart === 'string' ? parsed.weekStart : undefined
    const slots = parsed.slots
      .map((s) => normalizeSlot(s, anchor))
      .filter((s): s is PlannedSlot => s != null)

    return { slots: reconcile(slots, today) }
  } catch {
    return { slots: [] }
  }
}

function save(key: string, plan: StoredPlan) {
  localStorage.setItem(key, JSON.stringify(plan))
}

export function usePlannedMeals() {
  const storageKey = useProfileScopedKey(LEGACY_KEY)
  const [plan, setPlan] = useState<StoredPlan>(() => load(storageKey))

  useEffect(() => {
    setPlan(load(storageKey))
  }, [storageKey])

  const update = useCallback(
    (mutate: (slots: PlannedSlot[]) => PlannedSlot[]) => {
      setPlan((prev) => {
        const next: StoredPlan = { slots: mutate(prev.slots) }
        save(storageKey, next)
        return next
      })
    },
    [storageKey]
  )

  const getSlot = useCallback(
    (date: string, slot: MealSlot): PlannedSlot | undefined =>
      plan.slots.find((s) => s.date === date && s.slot === slot),
    [plan.slots]
  )

  /** Set the part for a role, leaving the rest of the slot alone. */
  const setPart = useCallback(
    (
      date: string,
      slot: MealSlot,
      role: PartRole,
      recipeId: number,
      source: Exclude<SlotSource, 'dismissed'>
    ) => {
      update((slots) => {
        const existing = slots.find((s) => s.date === date && s.slot === slot)
        const others = slots.filter((s) => !(s.date === date && s.slot === slot))
        const alive = existing && existing.source !== 'dismissed' ? existing : undefined
        const parts = dedupeParts([...(alive?.parts ?? []), { role, recipeId }])
        // `source` records how the prato was decided, so adding a drink or a
        // dessert must not rewrite an accepted slot into a chosen one.
        const nextSource = role === 'prato' || !alive ? source : alive.source
        return [...others, { date, slot, parts, source: nextSource }]
      })
    },
    [update]
  )

  /** Set the prato — the decision the suggestion engine drives. */
  const setSlot = useCallback(
    (
      date: string,
      slot: MealSlot,
      recipeId: number,
      source: Exclude<SlotSource, 'dismissed'>
    ) => setPart(date, slot, 'prato', recipeId, source),
    [setPart]
  )

  const removePart = useCallback(
    (date: string, slot: MealSlot, role: PartRole) => {
      update((slots) => {
        const existing = slots.find((s) => s.date === date && s.slot === slot)
        if (!existing) return slots
        const parts = existing.parts.filter((p) => p.role !== role)
        const others = slots.filter((s) => !(s.date === date && s.slot === slot))
        // Losing the prato empties the slot back to undecided.
        if (parts.length === 0 || role === 'prato') return others
        return [...others, { ...existing, parts }]
      })
    },
    [update]
  )

  const dismissSlot = useCallback(
    (date: string, slot: MealSlot) => {
      update((slots) => [
        ...slots.filter((s) => !(s.date === date && s.slot === slot)),
        { date, slot, parts: [], source: 'dismissed' as const },
      ])
    },
    [update]
  )

  const clearSlot = useCallback(
    (date: string, slot: MealSlot) => {
      update((slots) => slots.filter((s) => !(s.date === date && s.slot === slot)))
    },
    [update]
  )

  const clear = useCallback(() => update(() => []), [update])

  /** Drop everything from today onward, keeping the past record intact. */
  const clearUpcoming = useCallback(
    (today = todayIsoDate()) => update((slots) => slots.filter((s) => s.date < today)),
    [update]
  )

  return {
    slots: plan.slots,
    getSlot,
    setSlot,
    setPart,
    removePart,
    dismissSlot,
    clearSlot,
    clear,
    clearUpcoming,
  }
}
