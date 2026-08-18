import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MealListView } from '../hooks/useDisplayPrefs'
import { useListWindow } from '../hooks/useListWindow'
import type { Recipe } from '../types/grocy'
import {
  MEAL_LIST_PAGE_SIZE,
  sortPhotosFirst,
  splitByPhoto,
  windowItems,
} from '../utils/mealListWindow'
import { MealCard } from './MealCard'
import { MealCompactCell } from './MealCompactCell'
import { MealListRow } from './MealListRow'

interface Props {
  recipes: Recipe[]
  view: MealListView
  showPortions?: boolean
  onLogged?: (recipeId: number, description: string) => void
}

export function MealBrowseList({ recipes, view, showPortions, onLogged }: Props) {
  const navigate = useNavigate()
  const ordered = useMemo(() => sortPhotosFirst(recipes), [recipes])
  const resetKey = useMemo(() => recipes.map((r) => r.id).join(','), [recipes])
  const { visibleCount, sentinelRef, hasMore, loadMore } = useListWindow(
    ordered.length,
    MEAL_LIST_PAGE_SIZE,
    resetKey
  )
  const shown = windowItems(ordered, visibleCount)
  const { withPhoto, withoutPhoto } = splitByPhoto(shown)

  return (
    <div className="space-y-3">
      {withPhoto.length > 0 &&
        (view === 'list' ? (
          <ul className="bg-nourish-surface border border-nourish-border rounded-xl overflow-hidden divide-y divide-nourish-border/60">
            {withPhoto.map((r) => (
              <li key={r.id}>
                <MealListRow
                  recipe={r}
                  onClick={() => navigate(`/meal/${r.id}`)}
                  onLogged={onLogged}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {withPhoto.map((r) => (
              <MealCard
                key={r.id}
                recipe={r}
                showPortions={showPortions}
                onLogged={onLogged}
              />
            ))}
          </div>
        ))}

      {withoutPhoto.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {withoutPhoto.map((r) => (
            <MealCompactCell key={r.id} recipe={r} />
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={sentinelRef}>
          <button
            type="button"
            onClick={loadMore}
            className="w-full py-2.5 rounded-xl border border-nourish-border bg-nourish-surface text-sm font-semibold text-nourish-text-dim active:bg-nourish-surface-high focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          >
            Mostrar mais
          </button>
        </div>
      )}
    </div>
  )
}
