import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { Product, QuantityUnit, Recipe, RecipeIngredient } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { parseDescription, parseSteps } from '../utils/parseDescription'
import { isRestaurantMeal, mealOriginLabel, resolveMealOrigin } from '../utils/mealOrigin'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { useFavourites } from '../hooks/useFavourites'
import { useShowNutrition } from '../hooks/useShowNutrition'
import { getLastNavPath } from '../utils/navMemory'
import { deriveRecipeNutrition, isNutritionComplete } from '../utils/productNutrition'
import { makeProductMacroLookup } from '../utils/recipeNutrition'

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path
        fillRule="evenodd"
        d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.499.058l.346-9Z" clipRule="evenodd" />
    </svg>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-nourish-primary">
      <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-nourish-text-dim">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  )
}

export function MealDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isFavourite, toggle } = useFavourites()
  const showNutrition = useShowNutrition()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [products, setProducts] = useState<Record<number, Product>>({})
  const [units, setUnits] = useState<Record<number, QuantityUnit>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [kitchenMode, setKitchenMode] = useState(false)
  const [kitchenStep, setKitchenStep] = useState(0)

  // Built here rather than below the early returns, so the hook order stays fixed.
  const macroLookup = useMemo(
    () => makeProductMacroLookup(Object.values(products)),
    [products]
  )

  useEffect(() => {
    const numId = id ? parseInt(id, 10) : NaN
    if (!id || isNaN(numId)) {
      setError('ID inválido')
      setLoading(false)
      return
    }

    let mounted = true
    Promise.all([grocy.getRecipe(numId), grocy.getRecipeIngredients(numId)])
      .then(async ([r, ingrs]) => {
        if (!mounted) return
        setRecipe(r)
        setIngredients(ingrs)
        // Products are needed even without Grocy recipe ingredients, because
        // nutrition is derived from the macros stored on them.
        const [prods, qus] = await Promise.all([grocy.getProducts(), grocy.getQuantityUnits()])
        if (!mounted) return
        setProducts(Object.fromEntries(prods.map((p) => [p.id, p])))
        setUnits(Object.fromEntries(qus.map((u) => [u.id, u])))
      })
      .catch((e: Error) => { if (mounted) setError(e.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [id])

  async function handleDelete(recipeId: number) {
    setDeleting(true)
    setDeleteError(null)
    try {
      await grocy.deleteRecipe(recipeId)
      navigate(getLastNavPath('meals'))
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Erro ao apagar')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const header = (title: string, recipeId?: number) => (
    <header className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-nourish-border">
      <button
        onClick={() => navigate(getLastNavPath('meals'))}
        className="p-2 -ml-2 text-nourish-text-dim rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary"
      >
        <BackIcon />
      </button>
      <h2 className="font-semibold text-nourish-text text-lg truncate flex-1">{title}</h2>
      {recipeId !== undefined && (
        <button
          onClick={() => navigate(`/meal/${recipeId}/edit`)}
          className="p-2 text-nourish-text-dim rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary"
        >
          <PencilIcon />
        </button>
      )}
      {recipeId !== undefined && (
        <button
          onClick={() => toggle(recipeId)}
          className="p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary"
        >
          <HeartIcon filled={isFavourite(recipeId)} />
        </button>
      )}
      {recipeId !== undefined && (
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-2 -mr-2 text-nourish-text-dim hover:text-red-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary"
        >
          <TrashIcon />
        </button>
      )}
    </header>
  )

  if (loading) return <div className="min-h-screen bg-nourish-bg">{header('Detalhes')}<Spinner /></div>

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-nourish-bg">
        {header('Erro')}
        <div className="p-4">
          <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-xl text-sm">
            {error ?? 'Receita não encontrada'}
          </div>
        </div>
      </div>
    )
  }

  const parsed = parseDescription(recipe.description ?? '')
  const { ingredients: parsedIngr, steps, nutrition, price } = parsed
  const origin = resolveMealOrigin(parsed.origin)
  const restaurant = isRestaurantMeal(parsed.origin)
  const nutricaoOk = parsed.verified.includes('nutricao')
  const precoOk = parsed.verified.includes('preco')
  const stepLines = restaurant ? [] : parseSteps(steps)

  // Prefer nutrition computed from ingredient quantities × product macros.
  // Fall back to the hand-entered [Nutricao] block only while that is incomplete.
  const derived = restaurant
    ? null
    : deriveRecipeNutrition(parsed.ingredientItems, macroLookup, parsed.portions)

  const derivedOk = derived !== null && isNutritionComplete(derived)
  const shownNutrition = derivedOk ? derived : nutrition

  const nutritionItems = shownNutrition
    ? [
        { label: 'KCAL', value: shownNutrition.calories },
        { label: 'PROT', value: `${shownNutrition.protein}g` },
        { label: 'HC', value: `${shownNutrition.carbs}g` },
        { label: 'GORD', value: `${shownNutrition.fat}g` },
        ...(derivedOk ? [{ label: 'FIBRA', value: `${derived.fibre}g` }] : []),
      ]
    : []

  return (
    <div
      className="min-h-screen bg-nourish-bg"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
    >
      {header(recipe.name, recipe.id)}

      {recipe.picture_file_name && (
        <img
          src={grocy.pictureUrl(recipe.picture_file_name)}
          alt={recipe.name}
          className="w-full object-cover"
          style={{ height: 260, maxHeight: 260 }}
        />
      )}

      <div className="px-4 pt-5 space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded bg-nourish-surface-high text-nourish-text-dim font-semibold uppercase tracking-wider">
            {mealOriginLabel(origin)}
          </span>
          {parsed.category && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-nourish-surface-high text-nourish-text-dim font-medium">
              {parsed.category}
            </span>
          )}
          {restaurant && parsed.location && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-nourish-surface-high text-nourish-text font-medium">
              {parsed.location}
            </span>
          )}
          {!restaurant && parsed.timeMinutes !== null && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-nourish-surface-high text-nourish-text-dim font-medium tabular-nums">
              {parsed.timeMinutes} min
            </span>
          )}
        </div>

        {((showNutrition && shownNutrition) || price !== null) && (
          <div className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-3">
            {showNutrition && shownNutrition && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-nourish-text-dim">
                    {derivedOk ? 'Calculada dos ingredientes' : 'Estimada'}
                  </span>
                  {nutricaoOk && !derivedOk && <VerifiedBadge verified />}
                </div>
                <div
                  className={`grid gap-2 text-center ${
                    nutritionItems.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
                  }`}
                >
                  {nutritionItems.map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center gap-0.5">
                      <span className="text-nourish-primary font-bold text-sm tabular-nums">{value}</span>
                      <span className="text-nourish-text-dim text-[10px] tracking-wider">{label}</span>
                    </div>
                  ))}
                </div>
                {derived && !derivedOk && (derived.missingGrams.length > 0 || derived.missingMacros.length > 0) && (
                  <p className="text-[11px] text-nourish-text-dim leading-relaxed mt-3 pt-3 border-t border-nourish-border">
                    {derived.missingGrams.length > 0 && (
                      <>Sem quantidade: {derived.missingGrams.join(', ')}. </>
                    )}
                    {derived.missingMacros.length > 0 && (
                      <>Sem nutrição no produto: {derived.missingMacros.join(', ')}.</>
                    )}
                  </p>
                )}
              </div>
            )}
            {price !== null && (
              <div
                className={`flex items-center justify-between ${
                  showNutrition && shownNutrition ? 'border-t border-nourish-border pt-3' : ''
                }`}
              >
                <span className="text-nourish-text-dim text-sm">{precoOk ? 'Custo' : 'Custo estimado'}</span>
                <span className="text-nourish-primary font-semibold inline-flex items-center gap-1.5">
                  €{price.toFixed(2)}
                  {precoOk && <VerifiedBadge verified />}
                </span>
              </div>
            )}
          </div>
        )}

        {!restaurant && ingredients.length > 0 && (
          <section>
            <h3 className="font-semibold text-nourish-text mb-3">Ingredientes</h3>
            <ul className="space-y-2">
              {ingredients.map((ing) => {
                const product = products[ing.product_id]
                const unit = units[ing.qu_id]
                return (
                  <li key={ing.id} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-nourish-primary flex-shrink-0" />
                    <span className="text-nourish-text">{product?.name ?? `Produto ${ing.product_id}`}</span>
                    {ing.amount > 0 && (
                      <span className="ml-auto text-nourish-text-dim text-xs tabular-nums">
                        {ing.amount} {unit?.name ?? ''}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {!restaurant && ingredients.length === 0 && parsedIngr && (
          <section>
            <h3 className="font-semibold text-nourish-text mb-3">Ingredientes</h3>
            <ul className="space-y-2">
              {parsed.ingredientItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-nourish-primary flex-shrink-0" />
                  <span className="text-nourish-text">{item.name}</span>
                  {item.grams !== null && (
                    <span className="text-nourish-text-dim text-xs tabular-nums">
                      {item.grams} g
                    </span>
                  )}
                  {item.price !== null && (
                    <span className="ml-auto text-nourish-text-dim text-xs tabular-nums">
                      €{item.price.toFixed(2)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!restaurant && stepLines.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-nourish-text">Como fazer</h3>
              {stepLines.length > 1 && (
                <button
                  type="button"
                  onClick={() => { setKitchenStep(0); setKitchenMode(true) }}
                  className="text-xs font-semibold text-nourish-primary focus:outline-none"
                >
                  Modo cozinha
                </button>
              )}
            </div>
            <ol className="space-y-3">
              {stepLines.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-nourish-primary text-nourish-on-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-nourish-text-dim leading-relaxed pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {!restaurant && parsed.notes && (
          <section>
            <h3 className="font-semibold text-nourish-text mb-3">Notas</h3>
            <div className="rounded-xl border border-nourish-border bg-nourish-surface p-4">
              <p className="text-sm text-nourish-text-dim leading-relaxed whitespace-pre-line">
                {parsed.notes}
              </p>
            </div>
          </section>
        )}

        {deleteError && (
          <p className="text-red-400 text-xs text-center">{deleteError}</p>
        )}
      </div>

      {kitchenMode && stepLines.length > 0 && (
        <div className="fixed inset-0 z-50 bg-nourish-bg flex flex-col">
          <header className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-nourish-border">
            <button
              type="button"
              onClick={() => setKitchenMode(false)}
              className="p-2 -ml-2 text-nourish-text-dim rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            >
              <BackIcon />
            </button>
            <h2 className="font-semibold text-nourish-text text-lg truncate flex-1">{recipe.name}</h2>
          </header>
          <div className="flex-1 flex flex-col justify-center px-6 py-8">
            <p className="text-xs text-nourish-text-dim uppercase tracking-wider mb-3">
              Passo {kitchenStep + 1} de {stepLines.length}
            </p>
            <p className="text-nourish-text text-xl leading-relaxed font-medium">{stepLines[kitchenStep]}</p>
          </div>
          <div
            className="flex gap-2 p-4 border-t border-nourish-border"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
          >
            <button
              type="button"
              disabled={kitchenStep === 0}
              onClick={() => setKitchenStep((s) => s - 1)}
              className="flex-1 py-3.5 rounded-xl border border-nourish-border text-nourish-text-dim font-semibold text-sm disabled:opacity-30 focus:outline-none"
            >
              Anterior
            </button>
            {kitchenStep < stepLines.length - 1 ? (
              <button
                type="button"
                onClick={() => setKitchenStep((s) => s + 1)}
                className="flex-1 py-3.5 rounded-xl bg-nourish-primary text-nourish-on-primary font-semibold text-sm focus:outline-none"
              >
                Seguinte
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setKitchenMode(false)}
                className="flex-1 py-3.5 rounded-xl bg-nourish-primary text-nourish-on-primary font-semibold text-sm focus:outline-none"
              >
                Concluir
              </button>
            )}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface border-t border-nourish-border p-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        >
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="flex-1 py-3.5 rounded-xl border border-nourish-border text-nourish-text-dim font-semibold text-sm focus:outline-none"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleDelete(recipe.id)}
              disabled={deleting}
              className="flex-1 py-3.5 rounded-xl bg-red-600 text-white font-semibold text-sm active:opacity-90 disabled:opacity-50 focus:outline-none"
            >
              {deleting ? 'A apagar...' : 'Apagar refeição'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
