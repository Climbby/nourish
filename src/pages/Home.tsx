import { useEffect, useState } from 'react'
import { grocy } from '../api/grocy'
import type { Recipe } from '../types/grocy'
import { MealCard } from '../components/MealCard'
import { Spinner } from '../components/Spinner'
import { BottomNav } from '../components/BottomNav'

export function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    grocy
      .getRecipes()
      .then((data) => { if (mounted) setRecipes(data) })
      .catch((e: Error) => { if (mounted) setError(e.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen">
      <header className="bg-white px-4 pt-12 pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Nourish</h1>
        <p className="text-gray-500 text-sm mt-0.5">O que vais comer?</p>
      </header>

      <main className="p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        {loading && <Spinner />}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            Erro ao carregar refeições: {error}
          </div>
        )}

        {!loading && !error && recipes.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🍽️</div>
            <p className="font-medium text-gray-600">Sem refeições ainda</p>
            <p className="text-sm text-gray-400 mt-1">Adiciona a tua primeira refeição!</p>
          </div>
        )}

        {!loading && recipes.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {recipes.map((r) => (
              <MealCard key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
