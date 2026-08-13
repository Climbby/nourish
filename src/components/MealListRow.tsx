import { useState, type MouseEvent, type ReactNode } from 'react'
import { grocy } from '../api/grocy'
import type { Recipe } from '../types/grocy'
import { useShowNutrition } from '../hooks/useShowNutrition'
import { logMealConsumption } from '../utils/logMealConsumption'
import { parseDescription } from '../utils/parseDescription'
import { isRestaurantMeal, resolveMealOrigin } from '../utils/mealOrigin'
import { distanceFromHome, formatLocalityMeta, type Coords } from '../utils/locality'

interface Props {
  recipe: Recipe
  onClick: () => void
  /** When set, shows a Comi button on the right */
  onLogged?: (recipeId: number, description: string) => void
  /** Extra trailing control (rendered after Comi if both set) */
  trailing?: ReactNode
  homeCoords?: Coords | null
}

/** Compact meal row — same layout as Escolher / list view on Refeições. */
export function MealListRow({ recipe, onClick, onLogged, trailing, homeCoords }: Props) {
  const showNutrition = useShowNutrition()
  const { price, nutrition, location, locationCoords, origin } = parseDescription(recipe.description ?? '')
  const [logging, setLogging] = useState(false)
  const [logged, setLogged] = useState(false)
  const [logError, setLogError] = useState(false)
  const showMacros = showNutrition && nutrition
  const isFora = isRestaurantMeal(resolveMealOrigin(origin))
  const distMeta =
    isFora && location
      ? formatLocalityMeta(distanceFromHome(homeCoords, locationCoords))
      : null


  async function handleComi(e: MouseEvent) {
    e.stopPropagation()
    if (!onLogged || logging || logged) return
    setLogging(true)
    setLogError(false)
    try {
      const { description } = await logMealConsumption(recipe.id, recipe.description ?? '')
      onLogged(recipe.id, description)
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
    <div className="flex items-center gap-1 pr-2">
      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 flex items-center gap-3 p-2 rounded-lg text-left active:bg-nourish-surface-high focus:outline-none focus:ring-2 focus:ring-inset focus:ring-nourish-primary"
      >
        {recipe.picture_file_name ? (
          <img
            src={grocy.pictureUrl(recipe.picture_file_name)}
            alt=""
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-nourish-surface-high flex items-center justify-center text-xl flex-shrink-0">
            🍽️
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-nourish-text truncate">{recipe.name}</p>
          {isFora && location && (
            <p className="text-[11px] text-nourish-text-dim truncate mt-0.5">
              {location}
              {distMeta && <span className="tabular-nums"> · {distMeta}</span>}
            </p>
          )}
          <p className="text-xs text-nourish-text-dim tabular-nums mt-0.5">
            {price != null && (
              <span className="text-nourish-primary font-semibold">€{price.toFixed(2)}</span>
            )}
            {price != null && showMacros && ' · '}
            {showMacros && `${nutrition.calories} kcal`}
          </p>
        </div>
      </button>
      {onLogged && (
        <button
          type="button"
          onClick={handleComi}
          disabled={logging || logged}
          className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-nourish-primary text-nourish-on-primary text-xs font-semibold active:opacity-90 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
        >
          {logged ? '✓' : logging ? '…' : logError ? 'Erro' : 'Comi'}
        </button>
      )}
      {trailing}
    </div>
  )
}
