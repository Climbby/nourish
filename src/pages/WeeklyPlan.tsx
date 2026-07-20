import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { MealPlanEntry, Recipe } from '../types/grocy'
import { BottomNav } from '../components/BottomNav'
import { HelpInfo } from '../components/HelpInfo'
import { MacroChips, MacroSummaryBar } from '../components/MacroSummaryBar'
import { MealPickSheet } from '../components/MealPickSheet'
import { ShoppingListButton, ShoppingListSheet } from '../components/ShoppingListSheet'
import { Spinner } from '../components/Spinner'
import { useFavourites } from '../hooks/useFavourites'
import { DEFAULT_TARGETS, useNutritionTargets } from '../hooks/useNutritionTargets'
import {
  slotKey,
  slotHasMeal,
  usePlannedMeals,
  type MealSlot,
} from '../hooks/usePlannedMeals'
import { parseDescription } from '../utils/parseDescription'
import type { MealOrigin } from '../utils/mealOrigin'
import {
  filterNewShoppingNeeds,
  findIngredientShoppingNeeds,
} from '../utils/plannedMealsShopping'
import {
  loadSuggestionPreference,
  saveSuggestionPreference,
  type SuggestionPreference,
} from '../utils/suggestMeal'
import {
  buildSlotSuggestions,
  daySpend,
  MEAL_SLOTS,
  SLOT_LABEL,
  sumRecipesNutrition,
  visibleDayCount,
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
        aria-label="Fora"
        title="Fora"
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
        aria-label="Casa"
        title="Casa"
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

export function WeeklyPlan() {
  const navigate = useNavigate()
  const { favourites } = useFavourites()
  const { targets } = useNutritionTargets()
  const { slots, getSlot, setSlot, dismissSlot, clearSlot } = usePlannedMeals()

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shoppingOpen, setShoppingOpen] = useState(false)
  const [shoppingCount, setShoppingCount] = useState(0)
  const [preference, setPreference] = useState<SuggestionPreference>(() => loadSuggestionPreference())
  const [deniedByKey, setDeniedByKey] = useState<Record<string, number[]>>({})
  const [originByKey, setOriginByKey] = useState<Record<string, MealOrigin>>({})
  const [pickTarget, setPickTarget] = useState<{ dayOffset: number; slot: MealSlot } | null>(null)
  const [shoppingMealId, setShoppingMealId] = useState<number | null>(null)

  function slotOrigin(key: string): MealOrigin {
    return originByKey[key] ?? 'supermercado'
  }

  function setSlotOrigin(dayOffset: number, slot: MealSlot, origin: MealOrigin) {
    const key = slotKey(dayOffset, slot)
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

  const refreshShoppingCount = useCallback(async () => {
    const list = await grocy.getShoppingList()
    setShoppingCount(list.filter((i) => !i.done).length)
  }, [])

  useEffect(() => {
    let mounted = true
    Promise.all([grocy.getRecipes(), grocy.getMealPlan(), grocy.getShoppingList()])
      .then(([recipeList, plan, list]) => {
        if (!mounted) return
        setRecipes(recipeList)
        setMealPlan(plan)
        setShoppingCount(list.filter((i) => !i.done).length)
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

  const suggestions = useMemo(
    () =>
      !loading
        ? buildSlotSuggestions(ctx, planTargets, slots, deniedByKey, preference, originByKey)
        : new Map<string, number>(),
    [ctx, planTargets, slots, deniedByKey, preference, originByKey, loading]
  )

  const visibleDays = visibleDayCount(slots)

  const decidedRecipes = useMemo(
    () =>
      slots
        .filter(slotHasMeal)
        .map((s) => recipeById.get(s.recipeId))
        .filter((r): r is Recipe => r != null),
    [slots, recipeById]
  )

  const weekTotals = useMemo(() => sumRecipesNutrition(decidedRecipes), [decidedRecipes])

  const excludeForPick = useMemo(
    () => new Set(slots.filter(slotHasMeal).map((s) => s.recipeId)),
    [slots]
  )

  function handleAccept(dayOffset: number, slot: MealSlot) {
    const key = slotKey(dayOffset, slot)
    const recipeId = suggestions.get(key)
    if (recipeId == null) return
    setSlot(dayOffset, slot, recipeId, 'accepted')
    setDeniedByKey((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleDeny(dayOffset: number, slot: MealSlot) {
    const key = slotKey(dayOffset, slot)
    const recipeId = suggestions.get(key)
    if (recipeId == null) return
    setDeniedByKey((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), recipeId],
    }))
  }

  function handleDismiss(dayOffset: number, slot: MealSlot) {
    const key = slotKey(dayOffset, slot)
    dismissSlot(dayOffset, slot)
    setDeniedByKey((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleClear(dayOffset: number, slot: MealSlot) {
    const key = slotKey(dayOffset, slot)
    clearSlot(dayOffset, slot)
    setDeniedByKey((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handlePick(recipeId: number) {
    if (!pickTarget) return
    const { dayOffset, slot } = pickTarget
    const key = slotKey(dayOffset, slot)
    setSlot(dayOffset, slot, recipeId, 'chosen')
    setDeniedByKey((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
    setPickTarget(null)
  }

  async function handleAddToShopping(recipe: Recipe) {
    setShoppingMealId(recipe.id)
    try {
      const [products, stock, existingList] = await Promise.all([
        grocy.getProducts(),
        grocy.getDespensaStock(),
        grocy.getShoppingList(),
      ])
      const needs = findIngredientShoppingNeeds([recipe], products, stock)
      const toAdd = filterNewShoppingNeeds(needs, existingList)
      if (toAdd.length > 0) {
        await Promise.all(toAdd.map((n) => grocy.addToShoppingList(n.productId, n.buyAmount)))
        await refreshShoppingCount()
      }
    } finally {
      setShoppingMealId(null)
    }
  }

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="px-4 pt-12 pb-4 border-b border-nourish-border">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-nourish-text">Plano da semana</h1>
          <ShoppingListButton count={shoppingCount} onClick={() => setShoppingOpen(true)} />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div
            className="flex-1 grid grid-cols-3 gap-1 p-1 rounded-lg bg-nourish-surface border border-nourish-border"
            role="tablist"
            aria-label="Preferência de sugestões"
          >
            {(
              [
                { key: 'taste', label: 'Preferidos' },
                { key: 'cheap', label: 'Barato' },
                { key: 'balanced', label: 'Nutritivo' },
              ] as const
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
              {
                title: 'Nutritivo',
                body: 'O equilíbrio de calorias e macros.',
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
            {Array.from({ length: visibleDays }, (_, dayOffset) => {
              const spend = daySpend(dayOffset, slots, recipeById)
              return (
                <section key={dayOffset} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-xs font-semibold text-nourish-primary uppercase tracking-wider">
                      {weekdayLabel(dayOffset)}
                    </h2>
                    {spend > 0 && (
                      <span className="text-xs font-semibold text-nourish-primary tabular-nums">
                        €{spend.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {MEAL_SLOTS.map((slot) => {
                      const decided = getSlot(dayOffset, slot)
                      const key = slotKey(dayOffset, slot)
                      const origin = slotOrigin(key)

                      if (decided?.source === 'dismissed') {
                        return (
                          <li
                            key={slot}
                            className="p-3 rounded-lg border border-dashed border-nourish-border bg-nourish-surface/60"
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
                                onClick={() => handleClear(dayOffset, slot)}
                                className="text-xs font-semibold text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded-md px-2 py-1"
                              >
                                Desfazer
                              </button>
                            </div>
                          </li>
                        )
                      }

                      const suggestionId = suggestions.get(key)
                      const recipe = slotHasMeal(decided)
                        ? recipeById.get(decided.recipeId)
                        : suggestionId != null
                          ? recipeById.get(suggestionId)
                          : undefined

                      if (!recipe) {
                        return (
                          <li
                            key={slot}
                            className="p-3 rounded-lg border border-dashed border-nourish-border bg-nourish-surface text-sm text-nourish-text-dim space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold text-nourish-primary uppercase tracking-wider">
                                {SLOT_LABEL[slot]}
                              </p>
                              <SlotOriginIcons
                                origin={origin}
                                onChange={(next) => setSlotOrigin(dayOffset, slot, next)}
                              />
                            </div>
                            <p>
                              Sem sugestão {origin === 'restaurante' ? 'Fora' : 'Casa'} disponível
                            </p>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => setPickTarget({ dayOffset, slot })}
                                className="py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                              >
                                Escolher
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDismiss(dayOffset, slot)}
                                className="py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                              >
                                Dispensar
                              </button>
                            </div>
                          </li>
                        )
                      }

                      const parsed = parseDescription(recipe.description ?? '')
                      const isDecided = slotHasMeal(decided)

                      return (
                        <li
                          key={slot}
                          className={`border rounded-lg overflow-hidden ${
                            isDecided
                              ? 'bg-nourish-primary/5 border-nourish-primary/40'
                              : 'bg-nourish-surface border-nourish-border'
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
                                <p className="text-[10px] font-semibold text-nourish-primary uppercase tracking-wider">
                                  {SLOT_LABEL[slot]}
                                </p>
                                <p className="font-semibold text-sm text-nourish-text mt-0.5 truncate">
                                  {recipe.name}
                                </p>
                                <MacroChips nutrition={parsed.nutrition} price={parsed.price} />
                              </div>
                            </button>
                            {isDecided ? (
                              <button
                                type="button"
                                onClick={() => handleClear(dayOffset, slot)}
                                className="p-2 -mr-1 -mt-1 text-nourish-text-dim hover:text-red-400 focus:outline-none"
                                aria-label="Remover"
                              >
                                ✕
                              </button>
                            ) : (
                              <SlotOriginIcons
                                origin={origin}
                                onChange={(next) => setSlotOrigin(dayOffset, slot, next)}
                              />
                            )}
                          </div>

                          {isDecided ? (
                            <div className="px-3 pb-3">
                              <button
                                type="button"
                                disabled={shoppingMealId === recipe.id}
                                onClick={() => handleAddToShopping(recipe)}
                                className="w-full py-2 rounded-lg text-sm font-semibold border border-nourish-border text-nourish-text active:bg-nourish-surface-high disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                              >
                                {shoppingMealId === recipe.id
                                  ? 'A adicionar…'
                                  : 'Adicionar à lista'}
                              </button>
                            </div>
                          ) : (
                            <div className="px-3 pb-3 space-y-1">
                              <div className="grid grid-cols-3 gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAccept(dayOffset, slot)}
                                  className="py-2 rounded-lg text-xs font-semibold bg-nourish-primary text-nourish-on-primary focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                                >
                                  Aceitar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeny(dayOffset, slot)}
                                  className="py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                                >
                                  Outra
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPickTarget({ dayOffset, slot })}
                                  className="py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                                >
                                  Escolher
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDismiss(dayOffset, slot)}
                                className="w-full py-1.5 text-xs font-medium text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded-md"
                              >
                                Dispensar
                              </button>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}

            {slots.length > 0 && (
              <MacroSummaryBar
                totals={weekTotals}
                targets={planTargets}
                days={Math.max(1, Math.ceil(slots.length / 2))}
                label="Plano da semana"
              />
            )}
          </>
        )}
      </main>

      <MealPickSheet
        open={pickTarget != null}
        recipes={recipes}
        excludeIds={excludeForPick}
        initialOrigin={pickTarget ? slotOrigin(slotKey(pickTarget.dayOffset, pickTarget.slot)) : 'supermercado'}
        onClose={() => setPickTarget(null)}
        onPick={handlePick}
      />

      <ShoppingListSheet
        open={shoppingOpen}
        onClose={() => setShoppingOpen(false)}
        onListChange={refreshShoppingCount}
      />

      <BottomNav />
    </div>
  )
}
