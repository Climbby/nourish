import { useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Recipe } from '../types/grocy'
import { grocy } from '../api/grocy'
import { parseDescription } from '../utils/parseDescription'
import { logMealConsumption } from '../utils/logMealConsumption'
import { VerifiedBadge } from './VerifiedBadge'

interface Props {
  recipe: Recipe
  showPortions?: boolean
  onLogged?: (recipeId: number, description: string) => void
}

export function MealCard({ recipe, showPortions, onLogged }: Props) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)
  const [logging, setLogging] = useState(false)
  const [logged, setLogged] = useState(false)
  const [logError, setLogError] = useState(false)
  const { nutrition, price, portions, verified } = parseDescription(recipe.description ?? '')
  const nutricaoOk = verified.includes('nutricao')
  const precoOk = verified.includes('preco')

  async function handleComi(e: MouseEvent) {
    e.stopPropagation()
    if (logging || logged) return
    setLogging(true)
    setLogError(false)
    try {
      const { description } = await logMealConsumption(recipe.id, recipe.description ?? '')
      onLogged?.(recipe.id, description)
      setLogged(true)
      setTimeout(() => setLogged(false), 2500)
    } catch {
      setLogError(true)
      setTimeout(() => setLogError(false), 2500)
    } finally {
      setLogging(false)
    }
  }

  return (
    <div className="bg-nourish-surface rounded-2xl overflow-hidden border border-nourish-border text-left w-full h-full flex flex-col">
      <button
        type="button"
        onClick={() => navigate(`/meal/${recipe.id}`)}
        className="flex flex-col flex-1 min-h-0 text-left active:scale-[0.98] transition-transform duration-100 focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-inset"
      >
        <div className="relative flex-shrink-0">
          {recipe.picture_file_name && !imgError ? (
            <img
              src={grocy.pictureUrl(recipe.picture_file_name)}
              alt={recipe.name}
              className="w-full object-cover"
              style={{ aspectRatio: '4/3' }}
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              className="w-full bg-nourish-surface-high flex items-center justify-center text-4xl"
              style={{ aspectRatio: '4/3' }}
            >
              🍽️
            </div>
          )}
          {showPortions && portions !== null && portions > 0 && (
            <span className="absolute top-2 right-2 bg-nourish-primary text-nourish-on-primary text-xs font-bold px-2 py-0.5 rounded-full">
              {portions}×
            </span>
          )}
        </div>
        <div className="p-3 flex flex-col flex-1 gap-2">
          <h3 className="font-semibold text-nourish-text text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
            {recipe.name}
          </h3>

          {(price !== null || nutrition) && (
            <div className="mt-auto flex items-center justify-between gap-1 flex-wrap">
              {price !== null && (
                <span className="text-nourish-primary text-xs font-semibold inline-flex items-center gap-1">
                  €{price.toFixed(2)}
                  {precoOk && <VerifiedBadge verified />}
                </span>
              )}
              {nutrition && (
                <div className="flex gap-1 items-center">
                  {nutricaoOk && <VerifiedBadge verified className="mr-0.5" />}
                  <span className="px-1.5 py-0.5 bg-nourish-surface-high rounded-full text-nourish-text-dim text-xs tabular-nums">
                    {nutrition.protein}g P
                  </span>
                  <span className="px-1.5 py-0.5 bg-nourish-surface-high rounded-full text-nourish-text-dim text-xs tabular-nums">
                    {nutrition.carbs}g C
                  </span>
                  <span className="px-1.5 py-0.5 bg-nourish-surface-high rounded-full text-nourish-text-dim text-xs tabular-nums">
                    {nutrition.fat}g F
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </button>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={handleComi}
          disabled={logging || logged}
          className="w-full py-2 rounded-xl bg-nourish-primary text-nourish-on-primary text-xs font-semibold active:opacity-90 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-offset-1 focus:ring-offset-nourish-surface"
        >
          {logged ? 'Registado ✓' : logging ? '…' : logError ? 'Erro' : 'Comi'}
        </button>
      </div>
    </div>
  )
}
