import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { Product, QuantityUnit, Recipe, RecipeIngredient } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { stripHtml } from '../utils/stripHtml'

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

function parseDescription(raw: string): { ingredients: string | null; steps: string | null } {
  const text = stripHtml(raw)
  const ingrMatch = text.match(/\[Ingredientes\]([\s\S]*?)(?:\[Passos\]|$)/)
  const stepsMatch = text.match(/\[Passos\]([\s\S]*)$/)
  if (ingrMatch || stepsMatch) {
    return {
      ingredients: ingrMatch?.[1].trim() ?? null,
      steps: stepsMatch?.[1].trim() ?? null,
    }
  }
  return { ingredients: null, steps: text || null }
}

export function MealDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [products, setProducts] = useState<Record<number, Product>>({})
  const [units, setUnits] = useState<Record<number, QuantityUnit>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const header = (title: string) => (
    <header className="flex items-center gap-3 px-4 pt-12 pb-4 bg-white border-b border-gray-100">
      <button
        onClick={() => navigate('/')}
        className="p-2 -ml-2 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        <BackIcon />
      </button>
      <h2 className="font-semibold text-gray-900 text-lg truncate flex-1">{title}</h2>
    </header>
  )

  if (loading) return <div className="min-h-screen">{header('Detalhes')}<Spinner /></div>

  if (error || !recipe) {
    return (
      <div className="min-h-screen">
        {header('Erro')}
        <div className="p-4">
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error ?? 'Receita não encontrada'}
          </div>
        </div>
      </div>
    )
  }

  const parsed = parseDescription(recipe.description ?? '')

  return (
    <div className="min-h-screen" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 40px)' }}>
      {header(recipe.name)}

      {recipe.picture_file_name && (
        <img
          src={grocy.pictureUrl(recipe.picture_file_name)}
          alt={recipe.name}
          className="w-full object-cover"
          style={{ height: 260, maxHeight: 260 }}
        />
      )}

      <div className="px-4 pt-5 space-y-6">
        {/* Grocy-linked ingredients (existing recipes) */}
        {ingredients.length > 0 && (
          <section>
            <h3 className="font-semibold text-gray-900 mb-3">Ingredientes</h3>
            <ul className="space-y-2">
              {ingredients.map((ing) => {
                const product = products[ing.product_id]
                const unit = units[ing.qu_id]
                return (
                  <li key={ing.id} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{product?.name ?? `Produto ${ing.product_id}`}</span>
                    {ing.amount > 0 && (
                      <span className="ml-auto text-gray-400 text-xs tabular-nums">
                        {ing.amount} {unit?.name ?? ''}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Free-text ingredients from description (app-added recipes) */}
        {ingredients.length === 0 && parsed.ingredients && (
          <section>
            <h3 className="font-semibold text-gray-900 mb-3">Ingredientes</h3>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{parsed.ingredients}</p>
          </section>
        )}

        {/* Steps */}
        {parsed.steps && (
          <section>
            <h3 className="font-semibold text-gray-900 mb-3">Como fazer</h3>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{parsed.steps}</p>
          </section>
        )}
      </div>
    </div>
  )
}
