import { useCallback, useState } from 'react'

const STORAGE_KEY = 'nourish-planned-slots'

export type MealSlot = 'almoco' | 'jantar'
export type SlotSource = 'accepted' | 'chosen' | 'dismissed'

export interface PlannedSlot {
  dayOffset: number
  slot: MealSlot
  /** Null when the slot was dismissed / skipped. */
  recipeId: number | null
  source: SlotSource
}

interface StoredPlan {
  weekStart: string
  slots: PlannedSlot[]
}

export function todayIsoDate(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function slotKey(dayOffset: number, slot: MealSlot): string {
  return `${dayOffset}:${slot}`
}

export function slotHasMeal(
  slot: PlannedSlot | undefined
): slot is PlannedSlot & { recipeId: number } {
  return slot != null && slot.source !== 'dismissed' && slot.recipeId != null
}

function normalizeSlot(raw: unknown): PlannedSlot | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (typeof s.dayOffset !== 'number') return null
  if (s.slot !== 'almoco' && s.slot !== 'jantar') return null
  if (s.source === 'dismissed') {
    return { dayOffset: s.dayOffset, slot: s.slot, recipeId: null, source: 'dismissed' }
  }
  if (s.source !== 'accepted' && s.source !== 'chosen') return null
  if (typeof s.recipeId !== 'number') return null
  return {
    dayOffset: s.dayOffset,
    slot: s.slot,
    recipeId: s.recipeId,
    source: s.source,
  }
}

function load(today = todayIsoDate()): StoredPlan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { weekStart: today, slots: [] }
    const parsed = JSON.parse(raw) as StoredPlan
    if (!parsed || typeof parsed.weekStart !== 'string' || !Array.isArray(parsed.slots)) {
      return { weekStart: today, slots: [] }
    }
    if (parsed.weekStart !== today) {
      return { weekStart: today, slots: [] }
    }
    const slots = parsed.slots.map(normalizeSlot).filter((s): s is PlannedSlot => s != null)
    return { weekStart: parsed.weekStart, slots }
  } catch {
    return { weekStart: today, slots: [] }
  }
}

function save(plan: StoredPlan) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
}

export function usePlannedMeals() {
  const [plan, setPlan] = useState<StoredPlan>(() => load())

  const persist = useCallback((next: StoredPlan) => {
    save(next)
    setPlan(next)
  }, [])

  const getSlot = useCallback(
    (dayOffset: number, slot: MealSlot): PlannedSlot | undefined =>
      plan.slots.find((s) => s.dayOffset === dayOffset && s.slot === slot),
    [plan.slots]
  )

  const setSlot = useCallback(
    (dayOffset: number, slot: MealSlot, recipeId: number, source: Exclude<SlotSource, 'dismissed'>) => {
      const today = todayIsoDate()
      setPlan((prev) => {
        const base = prev.weekStart === today ? prev : { weekStart: today, slots: [] }
        const without = base.slots.filter((s) => !(s.dayOffset === dayOffset && s.slot === slot))
        const next: StoredPlan = {
          weekStart: today,
          slots: [...without, { dayOffset, slot, recipeId, source }],
        }
        save(next)
        return next
      })
    },
    []
  )

  const dismissSlot = useCallback((dayOffset: number, slot: MealSlot) => {
    const today = todayIsoDate()
    setPlan((prev) => {
      const base = prev.weekStart === today ? prev : { weekStart: today, slots: [] }
      const without = base.slots.filter((s) => !(s.dayOffset === dayOffset && s.slot === slot))
      const next: StoredPlan = {
        weekStart: today,
        slots: [...without, { dayOffset, slot, recipeId: null, source: 'dismissed' }],
      }
      save(next)
      return next
    })
  }, [])

  const clearSlot = useCallback((dayOffset: number, slot: MealSlot) => {
    setPlan((prev) => {
      const today = todayIsoDate()
      if (prev.weekStart !== today) {
        const empty = { weekStart: today, slots: [] as PlannedSlot[] }
        save(empty)
        return empty
      }
      const next: StoredPlan = {
        weekStart: prev.weekStart,
        slots: prev.slots.filter((s) => !(s.dayOffset === dayOffset && s.slot === slot)),
      }
      save(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    const next = { weekStart: todayIsoDate(), slots: [] as PlannedSlot[] }
    persist(next)
  }, [persist])

  return {
    weekStart: plan.weekStart,
    slots: plan.slots,
    getSlot,
    setSlot,
    dismissSlot,
    clearSlot,
    clear,
  }
}
