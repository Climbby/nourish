import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Recipe } from '../types/grocy'
import { grocy } from '../api/grocy'
import { stripHtml } from '../utils/stripHtml'

interface Props {
  recipe: Recipe
}

export function MealCard({ recipe }: Props) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)

  return (
    <button
      onClick={() => navigate(`/meal/${recipe.id}`)}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 text-left w-full active:scale-95 transition-transform duration-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
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
          className="w-full bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center text-4xl"
          style={{ aspectRatio: '4/3' }}
        >
          🍽️
        </div>
      )}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug">{recipe.name}</h3>
        {recipe.description && (
          <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">
            {stripHtml(recipe.description).substring(0, 120)}
          </p>
        )}
      </div>
    </button>
  )
}
