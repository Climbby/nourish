import { useCallback, useEffect, useState } from 'react'
import { grocy } from '../api/grocy'
import type { Recipe } from '../types/grocy'
import { MealBrowseList } from '../components/MealBrowseList'
import { ConnectionError } from '../components/ConnectionError'
import { Spinner } from '../components/Spinner'
import { BottomNav } from '../components/BottomNav'
import { useFavourites } from '../hooks/useFavourites'
import { useDisplayPrefs } from '../hooks/useDisplayPrefs'
import { parseDescription } from '../utils/parseDescription'

export function Favourites() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { favourites } = useFavourites()
  const { prefs } = useDisplayPrefs()

  const loadFavourites = useCallback(() => {
    setLoading(true)
    setError(null)
    grocy
      .getRecipes()
      .then(setRecipes)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadFavourites()
  }, [loadFavourites])

  const favouriteRecipes = recipes.filter((r) => {
    if (!favourites.has(r.id)) return false
    if (!prefs.hideProductsWithoutImage || r.picture_file_name) return true
    const category = parseDescription(r.description ?? '').category
    return category !== 'Completa' && category !== 'Ligeira'
  })

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="px-4 pt-12 pb-4 border-b border-nourish-border">
        <h1 className="text-2xl font-bold text-nourish-text">Favoritos</h1>
        <p className="text-nourish-text-dim text-sm mt-0.5">As tuas refeições preferidas</p>
      </header>

      <main className="p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        {loading && <Spinner />}

        {error && (
          <ConnectionError message={`Erro ao carregar: ${error}`} onRetry={loadFavourites} />
        )}

        {!loading && !error && favouriteRecipes.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🤍</div>
            <p className="font-medium text-nourish-text-dim">Sem favoritos ainda</p>
            <p className="text-sm text-nourish-border mt-1">Toca no ❤️ numa refeição para a adicionar</p>
          </div>
        )}

        {!loading && favouriteRecipes.length > 0 && (
          <MealBrowseList recipes={favouriteRecipes} view={prefs.mealListView} />
        )}
      </main>

      <BottomNav />
    </div>
  )
}
