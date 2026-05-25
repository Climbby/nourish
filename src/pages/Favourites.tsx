import { useEffect, useState } from 'react'
import { grocy } from '../api/grocy'
import type { Recipe } from '../types/grocy'
import { MealCard } from '../components/MealCard'
import { Spinner } from '../components/Spinner'
import { BottomNav } from '../components/BottomNav'
import { useFavourites } from '../hooks/useFavourites'

export function Favourites() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { favourites } = useFavourites()

  useEffect(() => {
    let mounted = true
    grocy
      .getRecipes()
      .then((data) => { if (mounted) setRecipes(data) })
      .catch((e: Error) => { if (mounted) setError(e.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const favouriteRecipes = recipes.filter((r) => favourites.has(r.id))

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="px-4 pt-12 pb-4 border-b border-nourish-border">
        <h1 className="text-2xl font-bold text-nourish-text">Favoritos</h1>
        <p className="text-nourish-text-dim text-sm mt-0.5">As tuas refeições preferidas</p>
      </header>

      <main className="p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        {loading && <Spinner />}

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-xl text-sm">
            Erro ao carregar: {error}
          </div>
        )}

        {!loading && !error && favouriteRecipes.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🤍</div>
            <p className="font-medium text-nourish-text-dim">Sem favoritos ainda</p>
            <p className="text-sm text-nourish-border mt-1">Toca no ❤️ numa refeição para a adicionar</p>
          </div>
        )}

        {!loading && favouriteRecipes.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {favouriteRecipes.map((r) => (
              <MealCard key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
