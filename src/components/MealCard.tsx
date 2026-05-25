import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Recipe } from '../types/grocy'
import { grocy } from '../api/grocy'
import { parseDescription } from '../utils/parseDescription'

interface Props {
  recipe: Recipe
}

export function MealCard({ recipe }: Props) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)
  const { nutrition, price } = parseDescription(recipe.description ?? '')

  return (
    <button
      onClick={() => navigate(`/meal/${recipe.id}`)}
      className="bg-nourish-surface rounded-2xl overflow-hidden border border-nourish-border text-left w-full active:scale-95 transition-transform duration-100 focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-offset-1 focus:ring-offset-nourish-bg"
    >
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
      <div className="p-3 space-y-2">
        <h3 className="font-semibold text-nourish-text text-sm leading-snug">{recipe.name}</h3>

        {(price !== null || nutrition) && (
          <div className="flex items-center justify-between gap-1 flex-wrap">
            {price !== null && (
              <span className="text-nourish-primary text-xs font-semibold">€{price.toFixed(2)}</span>
            )}
            {nutrition && (
              <div className="flex gap-1">
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
  )
}
