import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { MealPlanEntry, Recipe } from '../types/grocy'
import { BottomNav } from '../components/BottomNav'
import { MacroChips, MacroSummaryBar } from '../components/MacroSummaryBar'
import { ShoppingListButton, ShoppingListSheet } from '../components/ShoppingListSheet'
import { Spinner } from '../components/Spinner'
import { useFavourites } from '../hooks/useFavourites'
import { useNutritionTargets } from '../hooks/useNutritionTargets'
import { usePlannedMeals } from '../hooks/usePlannedMeals'
import { parseDescription } from '../utils/parseDescription'
import {
  filterNewShoppingNeeds,
  findIngredientShoppingNeeds,
} from '../utils/plannedMealsShopping'
import {
  pickBalancedWeeklySuggestions,
  sumWeekPlanNutrition,
} from '../utils/weeklyNutritionPlan'

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function WeeklyPlan() {
  const navigate = useNavigate()
  const { favourites } = useFavourites()
  const { targets } = useNutritionTargets()
  const { planned, add, addMany, remove, isPlanned } = usePlannedMeals()

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shoppingOpen, setShoppingOpen] = useState(false)
  const [shoppingCount, setShoppingCount] = useState(0)
  const [planning, setPlanning] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

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
      .catch((e: Error) => { if (mounted) setError(e.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const ctx = useMemo(
    () => ({ recipes, favourites, mealPlan }),
    [recipes, favourites, mealPlan]
  )

  const suggestions = useMemo(
    () => (!loading ? pickBalancedWeeklySuggestions(ctx, targets) : []),
    [ctx, targets, loading]
  )

  const suggestionTotals = useMemo(() => sumWeekPlanNutrition(suggestions), [suggestions])

  const recipeById = useMemo(
    () => new Map(recipes.map((r) => [r.id, r])),
    [recipes]
  )

  const plannedRecipes = useMemo(
    () =>
      planned
        .map((e) => recipeById.get(e.recipeId))
        .filter((r): r is Recipe => r != null),
    [planned, recipeById]
  )

  const plannedTotals = useMemo(() => {
    const items = plannedRecipes.map((recipe) => ({
      dayLabel: '',
      dayOffset: 0,
      recipe,
      focus: '',
      reason: '',
    }))
    return sumWeekPlanNutrition(items)
  }, [plannedRecipes])

  const unplannedIds = suggestions.filter((s) => !isPlanned(s.recipe.id)).map((s) => s.recipe.id)

  async function handlePlanWeek() {
    if (unplannedIds.length === 0 && plannedRecipes.length === 0) return
    setPlanning(true)
    setFeedback(null)
    try {
      if (unplannedIds.length > 0) addMany(unplannedIds)

      const allIds = [...new Set([...planned.map((p) => p.recipeId), ...unplannedIds])]
      const recipesForShop = allIds
        .map((id) => recipeById.get(id))
        .filter((r): r is Recipe => r != null)

      const [products, stock, existingList] = await Promise.all([
        grocy.getProducts(),
        grocy.getDespensaStock(),
        grocy.getShoppingList(),
      ])
      const needs = findIngredientShoppingNeeds(recipesForShop, products, stock)
      const toAdd = filterNewShoppingNeeds(needs, existingList)
      if (toAdd.length > 0) {
        await Promise.all(toAdd.map((n) => grocy.addToShoppingList(n.productId, n.buyAmount)))
        await refreshShoppingCount()
      }

      const addedMeals = unplannedIds.length
      const addedProducts = toAdd.length
      if (addedMeals > 0 && addedProducts > 0) {
        setFeedback(`${addedMeals} refeições planeadas · ${addedProducts} produtos na lista`)
      } else if (addedMeals > 0) {
        setFeedback(`${addedMeals} refeições planeadas · stock completo`)
      } else if (addedProducts > 0) {
        setFeedback(`${addedProducts} produtos adicionados à lista`)
      } else {
        setFeedback('Semana planead — nada em falta na despensa')
      }
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Erro ao planear')
    } finally {
      setPlanning(false)
    }
  }

  function handleRowTap(recipeId: number) {
    if (!isPlanned(recipeId)) add(recipeId)
  }

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="px-4 pt-12 pb-4 border-b border-nourish-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-nourish-text">Plano da semana</h1>
            <p className="text-nourish-text-dim text-sm mt-0.5">
              Dieta equilibrada · {targets.caloriesPerDay} kcal/dia
            </p>
          </div>
          <ShoppingListButton count={shoppingCount} onClick={() => setShoppingOpen(true)} />
        </div>
      </header>

      <main className="p-4 space-y-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        {loading && <Spinner />}

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-lg text-sm">
            Erro ao carregar: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {!planning && suggestions.length > 0 && (
              <button
                type="button"
                disabled={planning}
                onClick={handlePlanWeek}
                className="w-full py-3 rounded-lg font-semibold text-sm bg-nourish-primary text-nourish-on-primary disabled:opacity-50 active:opacity-90 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              >
                Planear semana equilibrada
              </button>
            )}

            {planning && (
              <p className="text-sm text-nourish-text-dim text-center py-2">A planear…</p>
            )}

            {feedback && (
              <p className="text-xs text-nourish-primary text-center">{feedback}</p>
            )}

            {suggestions.length > 0 && (
              <MacroSummaryBar
                totals={suggestionTotals}
                targets={targets}
                days={suggestions.length}
                label="Sugestões da semana"
              />
            )}

            <section>
              <h2 className="text-xs font-semibold text-nourish-primary uppercase tracking-wider mb-3">
                Sugestões por dia
              </h2>

              {suggestions.length === 0 ? (
                <p className="text-sm text-nourish-text-dim text-center py-8">
                  Adiciona refeições com nutrição para ver o plano
                </p>
              ) : (
                <ul className="space-y-2">
                  {suggestions.map(({ dayLabel, recipe, focus, reason }) => {
                    const parsed = parseDescription(recipe.description ?? '')
                    const already = isPlanned(recipe.id)
                    return (
                      <li
                        key={`${dayLabel}-${recipe.id}`}
                        className={`flex items-stretch gap-2 border rounded-lg overflow-hidden ${
                          already
                            ? 'bg-nourish-primary/5 border-nourish-primary/40'
                            : 'bg-nourish-surface border-nourish-border'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleRowTap(recipe.id)}
                          className="flex-1 min-w-0 p-3 text-left focus:outline-none focus:bg-nourish-surface-high/50"
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-semibold text-nourish-primary uppercase tracking-wider">
                              {dayLabel}
                            </p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-nourish-surface-high text-nourish-text-dim font-medium">
                              {focus}
                            </span>
                            {already && (
                              <span className="text-nourish-primary ml-auto">
                                <CheckIcon />
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-sm text-nourish-text mt-0.5 truncate">{recipe.name}</p>
                          <p className="text-xs text-nourish-text-dim mt-0.5 line-clamp-2">{reason}</p>
                          {parsed.nutrition && <MacroChips nutrition={parsed.nutrition} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/meal/${recipe.id}`)}
                          className="flex-shrink-0 px-3 border-l border-nourish-border text-nourish-text-dim active:bg-nourish-surface-high focus:outline-none focus:ring-2 focus:ring-inset focus:ring-nourish-primary"
                          aria-label="Ver refeição"
                        >
                          <ChevronIcon />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {plannedRecipes.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-semibold text-nourish-primary uppercase tracking-wider">
                  Próximas refeições
                </h2>

                <MacroSummaryBar
                  totals={plannedTotals}
                  targets={targets}
                  days={plannedRecipes.length}
                  label="Seleccionadas"
                />

                <ul className="space-y-2">
                  {planned.map(({ recipeId }) => {
                    const recipe = recipeById.get(recipeId)
                    if (!recipe) return null
                    return (
                      <li
                        key={recipeId}
                        className="flex items-center gap-2 p-3 bg-nourish-surface border border-nourish-primary/30 rounded-lg"
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/meal/${recipe.id}`)}
                          className="flex-1 min-w-0 text-left font-semibold text-sm text-nourish-text truncate focus:outline-none focus:underline"
                        >
                          {recipe.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(recipeId)}
                          className="p-2 text-nourish-text-dim hover:text-red-400 focus:outline-none"
                          aria-label="Remover"
                        >
                          ✕
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <p className="text-xs text-nourish-text-dim text-center">
              Objectivos em{' '}
              <Link to="/profile" className="text-nourish-primary underline-offset-2 hover:underline">
                Perfil
              </Link>
            </p>
          </>
        )}
      </main>

      <ShoppingListSheet
        open={shoppingOpen}
        onClose={() => setShoppingOpen(false)}
        onListChange={refreshShoppingCount}
      />

      <BottomNav />
    </div>
  )
}
