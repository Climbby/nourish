import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { MealPlanEntry, Recipe } from '../types/grocy'
import { BottomNav } from '../components/BottomNav'
import { HelpInfo } from '../components/HelpInfo'
import { MacroChips, MacroSummaryBar } from '../components/MacroSummaryBar'
import { MealPickSheet } from '../components/MealPickSheet'
import { PlanBuilderSheet } from '../components/PlanBuilderSheet'
import { SavedPlansSheet } from '../components/SavedPlansSheet'
import { SlotPartChips } from '../components/SlotPartChips'
import { useSavedWeekPlans } from '../hooks/useSavedWeekPlans'
import { HistoryButton } from '../components/HistoryButton'
import { Spinner } from '../components/Spinner'
import { useFavourites } from '../hooks/useFavourites'
import { useShowPrices } from '../hooks/useDisplayPrefs'
import { DEFAULT_TARGETS, useNutritionTargets } from '../hooks/useNutritionTargets'
import { useProfileScopedKey } from '../hooks/useProfileScopedKey'
import { useShowNutrition } from '../hooks/useShowNutrition'
import {
  slotKey,
  slotHasMeal,
  slotPrato,
  slotRecipeIds,
  todayIsoDate,
  usePlannedMeals,
  type MealSlot,
  type PlannedSlot,
  type SlotPart,
} from '../hooks/usePlannedMeals'
import { isPartRecipeRole } from '../utils/createPartRecipe'
import { roleForCategory, type PartRole } from '../utils/mealRole'
import { loadPartHabits, rememberPartHabit, type PartHabits } from '../utils/partHabits'
import { mapTemplateToDates, type TemplateSlot, type WeekPlanAnchor } from '../utils/savedWeekPlans'
import { mealOriginLabel, type MealOrigin } from '../utils/mealOrigin'
import { logMealConsumption, logSlotConsumption } from '../utils/logMealConsumption'
import { getActiveProfileId } from '../utils/householdProfiles'
import { isMealLogVisibleToProfile } from '../utils/mealLogAttribution'
import { parseDescription } from '../utils/parseDescription'
import { buildPastSlots, pastSlotsAsPlanned } from '../utils/pastPlan'
import {
  builderSuggestionPreference,
  weekSunday,
} from '../utils/planBuilder'
import { MAX_FUTURE_DAYS } from '../utils/planDates'
import { loadGenericoFavorites } from '../utils/genericoFavorites'
import {
  filterNewShoppingNeeds,
  findIngredientShoppingNeeds,
} from '../utils/plannedMealsShopping'
import {
  loadSuggestionPreference,
  saveSuggestionPreference,
  type SuggestionPreference,
} from '../utils/suggestMeal'
import { loadSuggestionSalt, rotateSuggestionSalt } from '../utils/suggestionSalt'
import { rememberNavPath } from '../utils/navMemory'
import { loadPlanOrigins, savePlanOrigins } from '../utils/planOriginsMemory'
import {
  buildSlotSuggestions,
  daySpend,
  MEAL_SLOTS,
  planDates,
  plannedDayCount,
  SLOT_LABEL,
  slotRecipes,
  slotTotals,
  sumRecipesNutrition,
  weekdayLabel,
} from '../utils/weekPlanSlots'

function HouseIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12 12 2.25 21.75 12" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5V19.5A1.5 1.5 0 0 0 6 21h3.75v-4.5a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5V21H18a1.5 1.5 0 0 0 1.5-1.5V10.5" />
    </svg>
  )
}

/** Fork · plate · knife */
function DiningOutIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      {/* fork — left */}
      <path strokeLinecap="round" d="M3.5 3.5v4M5 3.5v4M6.5 3.5v4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7.5h3V9c0 1-.75 1.75-1.5 1.75H5v8.75" />
      {/* plate — center */}
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2.75" />
      {/* knife — right */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 3.5c1.25 0 2.25 1 2.25 2.5V11H18.5V3.5Z" />
      <path strokeLinecap="round" d="M19.75 11v8.5" />
    </svg>
  )
}

function SlotOriginIcons({
  origin,
  onChange,
}: {
  origin: MealOrigin
  onChange: (next: MealOrigin) => void
}) {
  return (
    <div className="flex items-center gap-0.5" role="tablist" aria-label="Origem da sugestão">
      <button
        type="button"
        role="tab"
        aria-selected={origin === 'restaurante'}
        aria-label="Restaurante"
        title="Restaurante"
        onClick={() => onChange('restaurante')}
        className={`p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-nourish-primary/40 ${
          origin === 'restaurante' ? 'text-nourish-primary' : 'text-nourish-text-dim/45'
        }`}
      >
        <DiningOutIcon />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={origin === 'supermercado'}
        aria-label="Cozinha"
        title="Cozinha"
        onClick={() => onChange('supermercado')}
        className={`p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-nourish-primary/40 ${
          origin === 'supermercado' ? 'text-nourish-primary' : 'text-nourish-text-dim/45'
        }`}
      >
        <HouseIcon />
      </button>
    </div>
  )
}

const DISMISS_ANIM_MS = 280

/** Slot keys are `yyyy-mm-dd:slot`; anything else is a leftover offset key. */
const DATE_SLOT_KEY = /^\d{4}-\d{2}-\d{2}:(almoco|jantar)$/

export function WeeklyPlan() {
  const navigate = useNavigate()
  const { favourites } = useFavourites()
  const { targets, enabled: targetsEnabled, setEnabled: setTargetsEnabled } = useNutritionTargets()
  const nutritionActive = useShowNutrition()
  const showPrices = useShowPrices()
  const {
    slots,
    getSlot,
    setSlot,
    setPart,
    removePart,
    dismissSlot,
    clearSlot,
    clearUpcoming,
  } = usePlannedMeals()
  const { plans: savedPlans, save: saveWeekPlan, remove: removeWeekPlan } = useSavedWeekPlans()
  const [plansOpen, setPlansOpen] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const saltStorageKey = useProfileScopedKey('nourish-suggestion-salt')

  const today = todayIsoDate()

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preference, setPreference] = useState<SuggestionPreference>(() => loadSuggestionPreference())
  const [suggestionSalt, setSuggestionSalt] = useState(() => loadSuggestionSalt())
  const [deniedByKey, setDeniedByKey] = useState<Record<string, number[]>>({})
  const [originByKey, setOriginByKey] = useState<Record<string, MealOrigin>>(() => {
    // Drop pre-migration `0:almoco` keys, which can never match a date key again.
    const stored = loadPlanOrigins()
    return Object.fromEntries(
      Object.entries(stored).filter(([key]) => DATE_SLOT_KEY.test(key))
    )
  })

  useEffect(() => {
    rememberNavPath('plan', '/plan')
  }, [])

  useEffect(() => {
    setSuggestionSalt(loadSuggestionSalt())
  }, [saltStorageKey])

  useEffect(() => {
    savePlanOrigins(originByKey)
  }, [originByKey])
  const [pickTarget, setPickTarget] = useState<
    { date: string; slot: MealSlot; role: PartRole } | null
  >(null)
  const [habits, setHabits] = useState<PartHabits>(() => loadPartHabits())
  const [dismissingKeys, setDismissingKeys] = useState<Record<string, true>>({})
  const [enteringDismissedKeys, setEnteringDismissedKeys] = useState<Record<string, true>>({})
  const [undoingKeys, setUndoingKeys] = useState<Record<string, true>>({})
  const [enteringRestoredKeys, setEnteringRestoredKeys] = useState<Record<string, true>>({})
  const [pickingOutKeys, setPickingOutKeys] = useState<Record<string, true>>({})
  const [enteringChosenKeys, setEnteringChosenKeys] = useState<Record<string, true>>({})
  const [swappingKeys, setSwappingKeys] = useState<Record<string, true>>({})
  const [acceptingKeys, setAcceptingKeys] = useState<Record<string, true>>({})
  // Keyed by slot, not by recipe: one tap now logs the whole meal, and the
  // same recipe can sit in two different slots.
  const [comiByKey, setComiByKey] = useState<
    Record<string, 'idle' | 'logging' | 'logged' | 'error'>
  >({})
  const [comiFailedByKey, setComiFailedByKey] = useState<Record<string, string>>({})
  /** Past-day edits hit the network, so the slot locks while one is in flight. */
  const [pastBusyKeys, setPastBusyKeys] = useState<Record<string, true>>({})
  const dismissTimers = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const timers = dismissTimers.current
    return () => {
      for (const id of timers.values()) window.clearTimeout(id)
      timers.clear()
    }
  }, [])

  useEffect(() => {
    if (!nutritionActive && preference === 'balanced') {
      setPreference('taste')
      saveSuggestionPreference('taste')
    }
  }, [nutritionActive, preference])

  const [shoppingKey, setShoppingKey] = useState<string | null>(null)

  function slotOrigin(key: string): MealOrigin {
    return originByKey[key] ?? 'supermercado'
  }

  function setSlotOrigin(date: string, slot: MealSlot, origin: MealOrigin) {
    const key = slotKey(date, slot)
    setOriginByKey((prev) => {
      if ((prev[key] ?? 'supermercado') === origin) return prev
      return { ...prev, [key]: origin }
    })
    // Fresh pool when switching Casa ↔ Fora
    setDeniedByKey((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handlePreferenceChange(next: SuggestionPreference) {
    setPreference(next)
    saveSuggestionPreference(next)
  }

  const planTargets = targets.caloriesPerDay > 0 ? targets : DEFAULT_TARGETS

  useEffect(() => {
    let mounted = true
    Promise.all([grocy.getRecipes(), grocy.getMealPlan()])
      .then(([recipeList, plan]) => {
        if (!mounted) return
        setRecipes(recipeList)
        setMealPlan(plan)
      })
      .catch((e: Error) => {
        if (mounted) setError(e.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const ctx = useMemo(
    () => ({ recipes, favourites, mealPlan }),
    [recipes, favourites, mealPlan]
  )

  const recipeById = useMemo(
    () => new Map(recipes.map((r) => [r.id, r])),
    [recipes]
  )

  /** A habit whose recipe was deleted must not be offered on a chip. */
  const existingRecipeIds = useMemo(() => new Set(recipes.map((r) => r.id)), [recipes])

  const suggestions = useMemo(
    () =>
      !loading
        ? buildSlotSuggestions(
            ctx,
            planTargets,
            slots,
            deniedByKey,
            preference,
            originByKey,
            today,
            MAX_FUTURE_DAYS,
            suggestionSalt
          )
        : new Map<string, number>(),
    [ctx, planTargets, slots, deniedByKey, preference, originByKey, today, loading, suggestionSalt]
  )

  /** The role a logged recipe fills, read off its category. */
  const roleOf = useCallback(
    (recipeId: number) =>
      roleForCategory(parseDescription(recipeById.get(recipeId)?.description ?? '').category),
    [recipeById]
  )

  // Only meals this profile can see — the plan should not fill up with what the
  // rest of the household ate, the same rule History already applies.
  const visibleMealPlan = useMemo(() => {
    const activeId = getActiveProfileId()
    return mealPlan.filter((e) => isMealLogVisibleToProfile(e.note, activeId))
  }, [mealPlan])

  /** Yesterday and before, merged from the leftover plan and the Grocy record. */
  const pastViews = useMemo(
    () => buildPastSlots(slots, visibleMealPlan, roleOf, today),
    [slots, visibleMealPlan, roleOf, today]
  )

  const pastByKey = useMemo(
    () => new Map(pastViews.map((v) => [slotKey(v.date, v.slot), v])),
    [pastViews]
  )

  /**
   * What the list renders: the plan from today forward, plus the merged past.
   * A day logged from the Home page without ever being planned shows up here
   * too, which is the whole point of the merge.
   */
  const displaySlots = useMemo(
    () => [...slots.filter((s) => s.date >= today), ...pastSlotsAsPlanned(pastViews)],
    [slots, today, pastViews]
  )

  /** The plan owns today and the future; the past comes from the merge. */
  const slotFor = useCallback(
    (date: string, slot: MealSlot): PlannedSlot | undefined => {
      if (date >= today) return getSlot(date, slot)
      const view = pastByKey.get(slotKey(date, slot))
      if (!view) return undefined
      return { date, slot, parts: view.parts, source: 'chosen' }
    },
    [today, getSlot, pastByKey]
  )

  const dates = useMemo(() => planDates(displaySlots, today), [displaySlots, today])

  /** Only the upcoming plan feeds the summary — the past is a record, not a target. */
  const upcomingSlots = useMemo(() => slots.filter((s) => s.date >= today), [slots, today])

  const weekTotals = useMemo(
    () => sumRecipesNutrition(slotRecipes(upcomingSlots, recipeById)),
    [upcomingSlots, recipeById]
  )

  const excludeForPick = useMemo(
    () => new Set(upcomingSlots.flatMap(slotRecipeIds)),
    [upcomingSlots]
  )

  function handleAccept(date: string, slot: MealSlot) {
    const key = slotKey(date, slot)
    const recipeId = suggestions.get(key)
    if (recipeId == null || acceptingKeys[key] || pickingOutKeys[key]) return
    setSlot(date, slot, recipeId, 'accepted')
    setDeniedByKey((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    setAcceptingKeys((prev) => ({ ...prev, [key]: true }))
    const acceptKey = `accept:${key}`
    const prevTimer = dismissTimers.current.get(acceptKey)
    if (prevTimer != null) window.clearTimeout(prevTimer)
    const t = window.setTimeout(() => {
      dismissTimers.current.delete(acceptKey)
      setAcceptingKeys((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    }, 350)
    dismissTimers.current.set(acceptKey, t)
  }

  function handleDeny(date: string, slot: MealSlot) {
    const key = slotKey(date, slot)
    const recipeId = suggestions.get(key)
    if (recipeId == null || swappingKeys[key] || pickingOutKeys[key]) return
    setDeniedByKey((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), recipeId],
    }))
    setSwappingKeys((prev) => ({ ...prev, [key]: true }))
    const swapKey = `swap:${key}`
    const prevTimer = dismissTimers.current.get(swapKey)
    if (prevTimer != null) window.clearTimeout(prevTimer)
    const t = window.setTimeout(() => {
      dismissTimers.current.delete(swapKey)
      setSwappingKeys((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    }, 320)
    dismissTimers.current.set(swapKey, t)
  }

  function handleDismiss(date: string, slot: MealSlot) {
    const key = slotKey(date, slot)
    if (dismissingKeys[key]) return

    setDismissingKeys((prev) => ({ ...prev, [key]: true }))

    const prevTimer = dismissTimers.current.get(key)
    if (prevTimer != null) window.clearTimeout(prevTimer)

    const t = window.setTimeout(() => {
      dismissTimers.current.delete(key)
      dismissSlot(date, slot)
      setDeniedByKey((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
      setDismissingKeys((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
      setEnteringDismissedKeys((prev) => ({ ...prev, [key]: true }))

      const enterKey = `enter:${key}`
      const prevEnter = dismissTimers.current.get(enterKey)
      if (prevEnter != null) window.clearTimeout(prevEnter)
      const t2 = window.setTimeout(() => {
        dismissTimers.current.delete(enterKey)
        setEnteringDismissedKeys((prev) => {
          if (!(key in prev)) return prev
          const next = { ...prev }
          delete next[key]
          return next
        })
      }, DISMISS_ANIM_MS)
      dismissTimers.current.set(enterKey, t2)
    }, DISMISS_ANIM_MS)

    dismissTimers.current.set(key, t)
  }

  function handleClear(date: string, slot: MealSlot) {
    const key = slotKey(date, slot)
    clearSlot(date, slot)
    setDeniedByKey((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleUndoDismiss(date: string, slot: MealSlot) {
    const key = slotKey(date, slot)
    if (undoingKeys[key] || dismissingKeys[key]) return

    setUndoingKeys((prev) => ({ ...prev, [key]: true }))

    const undoKey = `undo:${key}`
    const prevTimer = dismissTimers.current.get(undoKey)
    if (prevTimer != null) window.clearTimeout(prevTimer)

    const t = window.setTimeout(() => {
      dismissTimers.current.delete(undoKey)
      clearSlot(date, slot)
      setDeniedByKey((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
      setUndoingKeys((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
      setEnteringRestoredKeys((prev) => ({ ...prev, [key]: true }))

      const enterKey = `restore:${key}`
      const prevEnter = dismissTimers.current.get(enterKey)
      if (prevEnter != null) window.clearTimeout(prevEnter)
      const t2 = window.setTimeout(() => {
        dismissTimers.current.delete(enterKey)
        setEnteringRestoredKeys((prev) => {
          if (!(key in prev)) return prev
          const next = { ...prev }
          delete next[key]
          return next
        })
      }, DISMISS_ANIM_MS)
      dismissTimers.current.set(enterKey, t2)
    }, DISMISS_ANIM_MS)

    dismissTimers.current.set(undoKey, t)
  }

  /**
   * Replace the upcoming plan with a template. Today-anchored moulds start at
   * today; constructor plans map Sunday onto this week's Sunday and skip the past.
   */
  function applyPlanSlots(planSlots: TemplateSlot[], weekAnchor: WeekPlanAnchor = 'today') {
    setSuggestionSalt(rotateSuggestionSalt())
    clearUpcoming(today)
    for (const s of mapTemplateToDates(planSlots, today, weekAnchor)) {
      for (const part of s.parts) {
        setPart(s.date, s.slot, part.role, part.recipeId, 'chosen')
      }
    }
  }

  /** Fill empty Dom–Sáb slots in the builder using the live Completa scorer. */
  function suggestEmptyForBuilder(decided: PlannedSlot[], honor = targetsEnabled) {
    const sunday = weekSunday(today)
    return buildSlotSuggestions(
      ctx,
      planTargets,
      decided,
      {},
      builderSuggestionPreference(honor, preference),
      {},
      sunday,
      7,
      suggestionSalt,
      7
    )
  }

  /**
   * Fill a side part. No animation: the card keeps its prato, only the chip
   * row changes, and every fill teaches the habit for next time.
   */
  function fillPart(date: string, slot: MealSlot, role: PartRole, recipeId: number) {
    setPart(date, slot, role, recipeId, 'chosen')
    if (isPartRecipeRole(role)) setHabits(rememberPartHabit(role, recipeId))
  }

  function handlePick(recipeId: number) {
    if (!pickTarget) return
    const { date, slot, role } = pickTarget

    if (date < today) {
      setPickTarget(null)
      void logPastPart(date, slot, role, recipeId)
      return
    }

    if (role !== 'prato') {
      setPickTarget(null)
      fillPart(date, slot, role, recipeId)
      return
    }

    const key = slotKey(date, slot)
    if (pickingOutKeys[key]) return
    setPickTarget(null)

    const finishPick = () => {
      setSlot(date, slot, recipeId, 'chosen')
      setDeniedByKey((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
      setPickingOutKeys((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
      setEnteringChosenKeys((prev) => ({ ...prev, [key]: true }))
      const enterKey = `chosen:${key}`
      const prevEnter = dismissTimers.current.get(enterKey)
      if (prevEnter != null) window.clearTimeout(prevEnter)
      const t2 = window.setTimeout(() => {
        dismissTimers.current.delete(enterKey)
        setEnteringChosenKeys((prev) => {
          if (!(key in prev)) return prev
          const next = { ...prev }
          delete next[key]
          return next
        })
      }, DISMISS_ANIM_MS)
      dismissTimers.current.set(enterKey, t2)
    }

    setPickingOutKeys((prev) => ({ ...prev, [key]: true }))
    const pickKey = `pick:${key}`
    const prevTimer = dismissTimers.current.get(pickKey)
    if (prevTimer != null) window.clearTimeout(prevTimer)
    const t = window.setTimeout(() => {
      dismissTimers.current.delete(pickKey)
      finishPick()
    }, DISMISS_ANIM_MS)
    dismissTimers.current.set(pickKey, t)
  }

  /** "Comi" logs every part of the meal, not just the prato. */
  async function handleComi(date: string, slot: MealSlot, parts: SlotPart[]) {
    const key = slotKey(date, slot)
    const state = comiByKey[key]
    if (state === 'logging' || state === 'logged') return

    setComiByKey((prev) => ({ ...prev, [key]: 'logging' }))
    setComiFailedByKey((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })

    try {
      // The card knows which meal it is — logging the jantar at 14:00 must not
      // land on almoço just because that is what the clock says.
      const { updated, failed } = await logSlotConsumption(parts, recipeById, {
        day: date,
        slot,
      })
      if (updated.length > 0) {
        const byId = new Map(updated.map((u) => [u.recipeId, u.description]))
        setRecipes((prev) =>
          prev.map((r) => (byId.has(r.id) ? { ...r, description: byId.get(r.id)! } : r))
        )
      }
      if (failed.length > 0) {
        setComiFailedByKey((prev) => ({
          ...prev,
          [key]: failed.map((f) => f.name).join(', '),
        }))
        setComiByKey((prev) => ({ ...prev, [key]: 'error' }))
      } else {
        setComiByKey((prev) => ({ ...prev, [key]: 'logged' }))
      }
    } catch {
      setComiByKey((prev) => ({ ...prev, [key]: 'error' }))
    }
  }

  async function handleAddToShopping(date: string, slot: MealSlot, partRecipes: Recipe[]) {
    const key = slotKey(date, slot)
    setShoppingKey(key)
    try {
      const [products, stock, existingList] = await Promise.all([
        grocy.getProducts(),
        grocy.getDespensaStock(),
        grocy.getShoppingList(),
      ])
      // Every part's ingredients — dedupe by product is already handled inside.
      const needs = findIngredientShoppingNeeds(
        partRecipes,
        products,
        stock,
        loadGenericoFavorites()
      )
      const toAdd = filterNewShoppingNeeds(needs, existingList)
      if (toAdd.length > 0) {
        await Promise.all(toAdd.map((n) => grocy.addToShoppingList(n.productId, n.buyAmount)))
      }
    } finally {
      setShoppingKey(null)
    }
  }

  async function refreshMealPlan() {
    try {
      setMealPlan(await grocy.getMealPlan())
    } catch {
      /* leave the record as it was — the next load will catch up */
    }
  }

  /**
   * A past day is a record, so editing it writes straight to Grocy rather than
   * to the plan in localStorage.
   */
  async function logPastPart(
    date: string,
    slot: MealSlot,
    role: PartRole,
    recipeId: number
  ) {
    const recipe = recipeById.get(recipeId)
    if (!recipe) return
    const key = slotKey(date, slot)
    if (pastBusyKeys[key]) return

    const view = pastByKey.get(key)
    const replacing = view?.parts.find((p) => p.role === role)
    const replacedEntryId =
      replacing && replacing.recipeId !== recipeId
        ? view?.entryIdByRecipe.get(replacing.recipeId)
        : undefined

    setPastBusyKeys((prev) => ({ ...prev, [key]: true }))
    try {
      const { description } = await logMealConsumption(recipe.id, recipe.description ?? '', {
        day: date,
        slot,
      })
      setRecipes((prev) =>
        prev.map((r) => (r.id === recipe.id ? { ...r, description } : r))
      )
      // Correcting the record means the old entry is no longer true.
      if (replacedEntryId != null) await grocy.deleteMealPlanEntry(replacedEntryId)
      if (replacing) removePart(date, slot, role)
      await refreshMealPlan()
      if (isPartRecipeRole(role)) setHabits(rememberPartHabit(role, recipeId))
    } catch {
      /* the card keeps showing the record as Grocy last reported it */
    } finally {
      setPastBusyKeys((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  async function removePastPart(date: string, slot: MealSlot, role: PartRole) {
    const key = slotKey(date, slot)
    if (pastBusyKeys[key]) return
    const view = pastByKey.get(key)
    const part = view?.parts.find((p) => p.role === role)
    if (!part) return

    const entryId = view?.entryIdByRecipe.get(part.recipeId)
    setPastBusyKeys((prev) => ({ ...prev, [key]: true }))
    try {
      if (entryId != null) {
        await grocy.deleteMealPlanEntry(entryId)
        await refreshMealPlan()
      }
      // A part that was only ever planned still sits in localStorage.
      removePart(date, slot, role)
    } catch {
      /* nothing removed — the card still shows what Grocy holds */
    } finally {
      setPastBusyKeys((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="px-4 pt-12 pb-4 border-b border-nourish-border">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-nourish-text">Plano da semana</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPlansOpen(true)}
              aria-label="Planos semanais guardados"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            >
              Planos
            </button>
            <HistoryButton to="/history?tab=supermarket" label="Historial de supermercado" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div
            className={`flex-1 grid gap-1 p-1 rounded-lg bg-nourish-surface border border-nourish-border ${
              nutritionActive ? 'grid-cols-3' : 'grid-cols-2'
            }`}
            role="tablist"
            aria-label="Preferência de sugestões"
          >
            {(
              nutritionActive
                ? ([
                    { key: 'taste', label: 'Preferidos' },
                    { key: 'cheap', label: 'Barato' },
                    { key: 'balanced', label: 'Nutritivo' },
                  ] as const)
                : ([
                    { key: 'taste', label: 'Preferidos' },
                    { key: 'cheap', label: 'Barato' },
                  ] as const)
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={preference === key}
                onClick={() => handlePreferenceChange(key)}
                className={`py-2 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                  preference === key
                    ? 'bg-nourish-primary text-nourish-on-primary'
                    : 'text-nourish-text-dim'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <HelpInfo
            title="Como funcionam as sugestões"
            label="Ajuda sobre o plano"
            sections={[
              {
                title: 'Preferidos',
                body: 'Os teus favoritos.',
              },
              {
                title: 'Barato',
                body: 'Os preços mais baixos.',
              },
              ...(nutritionActive
                ? [
                    {
                      title: 'Nutritivo',
                      body: 'O equilíbrio de calorias e macros.',
                    },
                  ]
                : []),
              {
                title: 'Dias anteriores',
                body: 'Os últimos 7 dias ficam por baixo de hoje, como registo do que comeste. Podes corrigi-los, mas não recebem sugestões.',
              },
            ]}
          />
        </div>
      </header>

      <main
        className="p-4 space-y-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
      >
        {loading && <Spinner />}

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-lg text-sm">
            Erro ao carregar: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {dates.map((date, index) => {
              const spend = daySpend(date, displaySlots, recipeById)
              const isPast = date < today
              const firstPast = isPast && (index === 0 || dates[index - 1] >= today)

              return (
                <section key={date} className="space-y-2">
                  {firstPast && (
                    <div className="flex items-center gap-3 pt-2 pb-1" aria-hidden>
                      <span className="h-px flex-1 bg-nourish-border" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-nourish-text-dim">
                        Já comido
                      </span>
                      <span className="h-px flex-1 bg-nourish-border" />
                    </div>
                  )}

                  <div className="flex items-baseline justify-between gap-2">
                    <h2
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        isPast ? 'text-nourish-text-dim' : 'text-nourish-primary'
                      }`}
                    >
                      {weekdayLabel(date, today)}
                    </h2>
                    {showPrices && spend > 0 && (
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          isPast ? 'text-nourish-text-dim' : 'text-nourish-primary'
                        }`}
                      >
                        €{spend.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {MEAL_SLOTS.map((slot) => {
                      const decided = slotFor(date, slot)
                      const key = slotKey(date, slot)
                      const origin = slotOrigin(key)
                      const loggedIds = pastByKey.get(key)?.logged
                      const pastBusy = Boolean(pastBusyKeys[key])

                      // Past days hold a record, not empty space to fill.
                      if (isPast && !decided) return null

                      if (decided?.source === 'dismissed') {
                        return (
                          <li
                            key={slot}
                            className={`p-3 rounded-lg border border-dashed border-nourish-border bg-nourish-surface/60 ${
                              enteringDismissedKeys[key]
                                ? 'animate-plan-dismiss-in'
                                : undoingKeys[key]
                                  ? 'animate-plan-undo-out'
                                  : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-[10px] font-semibold text-nourish-primary uppercase tracking-wider">
                                  {SLOT_LABEL[slot]}
                                </p>
                                <p className="text-sm text-nourish-text-dim mt-0.5">Dispensado</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUndoDismiss(date, slot)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded-md px-2 py-1"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="w-3.5 h-3.5"
                                  aria-hidden
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Desfazer
                              </button>
                            </div>
                          </li>
                        )
                      }

                      const pratoId = slotPrato(decided)
                      const suggestionId = suggestions.get(key)
                      const recipe =
                        pratoId != null
                          ? recipeById.get(pratoId)
                          : suggestionId != null
                            ? recipeById.get(suggestionId)
                            : undefined

                      if (!recipe) {
                        return (
                          <li
                            key={slot}
                            className={`p-3 rounded-lg border border-dashed border-nourish-border bg-nourish-surface text-sm text-nourish-text-dim space-y-2 ${
                              dismissingKeys[key]
                                ? 'animate-plan-dismiss-out'
                                : pickingOutKeys[key]
                                  ? 'animate-plan-undo-out'
                                  : enteringRestoredKeys[key]
                                    ? 'animate-plan-undo-in'
                                    : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold text-nourish-primary uppercase tracking-wider">
                                {SLOT_LABEL[slot]}
                              </p>
                              <SlotOriginIcons
                                origin={origin}
                                onChange={(next) => setSlotOrigin(date, slot, next)}
                              />
                            </div>
                            <p>
                              Sem sugestão {mealOriginLabel(origin)} disponível
                            </p>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => setPickTarget({ date, slot, role: 'prato' })}
                                className="py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                              >
                                Escolher
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDismiss(date, slot)}
                                className="py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                              >
                                Dispensar
                              </button>
                            </div>
                          </li>
                        )
                      }

                      const isDecided = slotHasMeal(decided)
                      const wasLogged = loggedIds?.has(recipe.id) ?? false

                      // A decided slot totals the whole meal; an unaccepted
                      // suggestion still speaks only for the prato it proposes.
                      const partRecipes =
                        decided && decided.parts.length > 0
                          ? slotRecipes([decided], recipeById)
                          : [recipe]
                      const { nutrition: slotNutrition, price: slotPrice } =
                        slotTotals(partRecipes)

                      return (
                        <li
                          key={slot}
                          className={`border rounded-lg overflow-hidden ${
                            isPast
                              ? 'bg-nourish-surface/50 border-nourish-border opacity-75'
                              : isDecided
                                ? 'bg-nourish-primary/5 border-nourish-primary/40'
                                : 'bg-nourish-surface border-nourish-border'
                          } ${
                            dismissingKeys[key]
                              ? 'animate-plan-dismiss-out'
                              : pickingOutKeys[key]
                                ? 'animate-plan-undo-out'
                                : enteringChosenKeys[key] || enteringRestoredKeys[key]
                                  ? enteringChosenKeys[key]
                                    ? 'animate-plan-dismiss-in'
                                    : 'animate-plan-undo-in'
                                  : acceptingKeys[key]
                                    ? 'animate-plan-accept'
                                    : swappingKeys[key]
                                      ? 'animate-plan-swap'
                                      : ''
                          }`}
                        >
                          <div className="flex items-start gap-3 p-3">
                            <button
                              type="button"
                              onClick={() => navigate(`/meal/${recipe.id}`)}
                              className="flex flex-1 min-w-0 items-center gap-3 text-left focus:outline-none"
                            >
                              {recipe.picture_file_name ? (
                                <img
                                  src={grocy.pictureUrl(recipe.picture_file_name)}
                                  alt=""
                                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-xl bg-nourish-surface-high flex items-center justify-center text-2xl flex-shrink-0">
                                  🍽️
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-semibold text-nourish-primary uppercase tracking-wider flex items-center gap-1.5">
                                  {SLOT_LABEL[slot]}
                                  {wasLogged && (
                                    <span
                                      className="text-nourish-primary normal-case tracking-normal"
                                      title="Registado"
                                    >
                                      ✓
                                    </span>
                                  )}
                                </p>
                                <p className="font-semibold text-sm text-nourish-text mt-0.5 truncate">
                                  {recipe.name}
                                </p>
                                <MacroChips
                                  nutrition={slotNutrition}
                                  price={slotPrice}
                                  showNutrition={nutritionActive}
                                  showPrices={showPrices}
                                />
                              </div>
                            </button>
                            {isDecided ? (
                              <button
                                type="button"
                                onClick={() =>
                                  isPast
                                    ? void removePastPart(date, slot, 'prato')
                                    : handleClear(date, slot)
                                }
                                disabled={pastBusy}
                                className="p-2 -mr-1 -mt-1 text-nourish-text-dim hover:text-red-400 disabled:opacity-50 focus:outline-none"
                                aria-label="Remover"
                              >
                                ✕
                              </button>
                            ) : (
                              <SlotOriginIcons
                                origin={origin}
                                onChange={(next) => setSlotOrigin(date, slot, next)}
                              />
                            )}
                          </div>

                          {decided && (
                            <SlotPartChips
                              parts={decided.parts}
                              recipeById={recipeById}
                              habits={habits}
                              existingIds={existingRecipeIds}
                              dim={isPast}
                              logged={loggedIds}
                              busy={pastBusy}
                              onFill={(role, recipeId) =>
                                isPast
                                  ? void logPastPart(date, slot, role, recipeId)
                                  : fillPart(date, slot, role, recipeId)
                              }
                              onOpen={(role) => setPickTarget({ date, slot, role })}
                              onRemove={(role) =>
                                isPast
                                  ? void removePastPart(date, slot, role)
                                  : removePart(date, slot, role)
                              }
                            />
                          )}

                          {isPast ? null : isDecided ? (
                            <div className="px-3 pb-3">
                              <div className="grid gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleComi(date, slot, decided?.parts ?? [])}
                                  disabled={
                                    comiByKey[key] === 'logging' || comiByKey[key] === 'logged'
                                  }
                                  className="py-2 rounded-lg text-xs font-semibold bg-nourish-primary text-nourish-on-primary active:opacity-90 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                                >
                                  {comiByKey[key] === 'logged'
                                    ? 'Registado ✓'
                                    : comiByKey[key] === 'logging'
                                      ? '…'
                                      : comiByKey[key] === 'error'
                                        ? 'Erro'
                                        : 'Comi'}
                                </button>
                                {comiFailedByKey[key] && (
                                  <p className="text-[11px] text-red-400 px-0.5">
                                    Falhou: {comiFailedByKey[key]}
                                  </p>
                                )}
                                <button
                                  type="button"
                                  disabled={shoppingKey === key}
                                  onClick={() => handleAddToShopping(date, slot, partRecipes)}
                                  className="py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text active:bg-nourish-surface-high disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                                >
                                  {shoppingKey === key ? 'A adicionar…' : 'Adicionar à lista'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="px-3 pb-3">
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAccept(date, slot)}
                                  className="py-2 rounded-lg text-xs font-semibold bg-nourish-primary text-nourish-on-primary focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                                >
                                  Aceitar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeny(date, slot)}
                                  className="py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                                >
                                  Outra
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPickTarget({ date, slot, role: 'prato' })}
                                  className="py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                                >
                                  Escolher
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDismiss(date, slot)}
                                  className="py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                                >
                                  Dispensar
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}

            {upcomingSlots.length > 0 && (
              <MacroSummaryBar
                totals={weekTotals}
                targets={planTargets}
                days={Math.max(1, plannedDayCount(slots, today))}
                label="Plano da semana"
                showNutrition={nutritionActive}
                showPrices={showPrices}
              />
            )}
          </>
        )}
      </main>

      <MealPickSheet
        open={pickTarget != null}
        recipes={recipes}
        role={pickTarget?.role ?? 'prato'}
        // Sides are meant to repeat — the same water every day is the point.
        // Only the prato avoids what the upcoming plan already holds.
        excludeIds={pickTarget?.role === 'prato' ? excludeForPick : undefined}
        initialOrigin={pickTarget ? slotOrigin(slotKey(pickTarget.date, pickTarget.slot)) : 'supermercado'}
        onClose={() => setPickTarget(null)}
        onPick={handlePick}
        onRecipeCreated={(recipe) => setRecipes((prev) => [...prev, recipe])}
      />

      <SavedPlansSheet
        open={plansOpen}
        plans={savedPlans}
        recipes={recipes}
        currentSlots={slots}
        onClose={() => setPlansOpen(false)}
        onSave={saveWeekPlan}
        onApply={applyPlanSlots}
        onRemove={removeWeekPlan}
        onOpenBuilder={() => setBuilderOpen(true)}
      />

      <PlanBuilderSheet
        open={builderOpen}
        recipes={recipes}
        onClose={() => setBuilderOpen(false)}
        onSave={saveWeekPlan}
        onApply={applyPlanSlots}
        suggestEmpty={suggestEmptyForBuilder}
        honorTargets={targetsEnabled}
        targets={planTargets}
        onIgnoreTargets={() => setTargetsEnabled(false)}
      />

      <BottomNav />
    </div>
  )
}
