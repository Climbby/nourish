import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { Product, QuantityUnit, Recipe, RecipeIngredient } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { parseDescription } from '../utils/parseDescription'
import { useFavourites } from '../hooks/useFavourites'

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
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [products, setProducts] = useState<Record<number, Product>>({})
  const [units, setUnits] = useState<Record<number, QuantityUnit>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  const [logged, setLogged] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
        if (ingrs.length > 0) {
          const [prods, qus] = await Promise.all([grocy.getProducts(), grocy.getQuantityUnits()])
          if (!mounted) return
          setProducts(Object.fromEntries(prods.map((p) => [p.id, p])))
          setUnits(Object.fromEntries(qus.map((u) => [u.id, u])))
        }
      })
      .catch((e: Error) => { if (mounted) setError(e.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [id])

  async function handleLog(recipeId: number) {
    setLogging(true)
    setLogError(null)
    const d = new Date()
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    try {
      await grocy.logMeal({ day, recipe_id: recipeId, note: '' })
      setLogged(true)
      setTimeout(() => setLogged(false), 2500)
    } catch (e) {
      setLogError(e instanceof Error ? e.message : 'Erro ao registar')
    } finally {
      setLogging(false)
    }
  }

  async function handleDelete(recipeId: number) {
    setDeleting(true)
    try {
      await grocy.deleteRecipe(recipeId)
      navigate('/')
    } catch (e) {
      setLogError(e instanceof Error ? e.message : 'Erro ao apagar')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const header = (title: string, recipeId?: number) => (
    <header className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-nourish-border">
      <button
        onClick={() => navigate('/')}
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

  const nutritionItems = nutrition
    ? [
        { label: 'KCAL', value: nutrition.calories },
        { label: 'PROT', value: `${nutrition.protein}g` },
        { label: 'HC', value: `${nutrition.carbs}g` },
        { label: 'GORD', value: `${nutrition.fat}g` },
      ]
    : []

  return (
    <div className="min-h-screen bg-nourish-bg" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}>
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
        {/* Nutrition + price card */}
        {(nutrition || price !== null) && (
          <div className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-3">
            {nutrition && (
              <div className="grid grid-cols-4 gap-2 text-center">
                {nutritionItems.map(({ label, value }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5">
                    <span className="text-nourish-primary font-bold text-sm tabular-nums">{value}</span>
                    <span className="text-nourish-text-dim text-xs tracking-wider">{label}</span>
                  </div>
                ))}
              </div>
            )}
            {price !== null && (
              <div className={`flex items-center justify-between ${nutrition ? 'border-t border-nourish-border pt-3' : ''}`}>
                <span className="text-nourish-text-dim text-sm">Custo estimado</span>
                <span className="text-nourish-primary font-semibold">€{price.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* Grocy-linked ingredients */}
        {ingredients.length > 0 && (
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

        {/* Free-text ingredients from description */}
        {ingredients.length === 0 && parsedIngr && (
          <section>
            <h3 className="font-semibold text-nourish-text mb-3">Ingredientes</h3>
            <ul className="space-y-2">
              {parsed.ingredientItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-nourish-primary flex-shrink-0" />
                  <span className="text-nourish-text">{item.name}</span>
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

        {/* Steps */}
        {steps && (
          <section>
            <h3 className="font-semibold text-nourish-text mb-3">Como fazer</h3>
            <p className="text-nourish-text-dim text-sm leading-relaxed whitespace-pre-line">{steps}</p>
          </section>
        )}
      </div>

      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface border-t border-nourish-border p-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        {logError && (
          <p className="text-red-400 text-xs text-center mb-2">{logError}</p>
        )}
        {confirmDelete ? (
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
        ) : (
          <button
            onClick={() => handleLog(recipe.id)}
            disabled={logging || logged}
            className="w-full bg-nourish-primary text-nourish-on-primary font-semibold py-3.5 rounded-xl active:opacity-90 transition-opacity disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-offset-2 focus:ring-offset-nourish-surface"
          >
            {logged ? 'Registado ✓' : logging ? 'A registar...' : 'Registar refeição'}
          </button>
        )}
      </div>
    </div>
  )
}
