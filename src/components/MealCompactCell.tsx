import { useNavigate } from 'react-router-dom'
import type { Recipe } from '../types/grocy'
import { eatOutRestaurantName, resolveMealOrigin } from '../utils/mealOrigin'
import { parseDescription } from '../utils/parseDescription'

interface Props {
  recipe: Recipe
}

/** Name-only grelha cell — no photo, no cutlery placeholder. */
export function MealCompactCell({ recipe }: Props) {
  const navigate = useNavigate()
  const { location, origin } = parseDescription(recipe.description ?? '')
  const restaurant = eatOutRestaurantName(resolveMealOrigin(origin), location)

  return (
    <button
      type="button"
      onClick={() => navigate(`/meal/${recipe.id}`)}
      className="w-full h-full text-left rounded-xl border border-nourish-border bg-nourish-surface px-2.5 py-2.5 active:scale-[0.98] transition-transform duration-100 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
    >
      <p className="text-xs font-semibold text-nourish-text leading-snug line-clamp-2">
        {recipe.name}
      </p>
      {restaurant && (
        <p className="text-[10px] text-nourish-text-dim truncate mt-0.5">{restaurant}</p>
      )}
    </button>
  )
}
