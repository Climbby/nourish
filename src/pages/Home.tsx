import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { MealPlanEntry, Recipe } from '../types/grocy'
import { MealCard } from '../components/MealCard'
import { Spinner } from '../components/Spinner'
import { BottomNav } from '../components/BottomNav'
import { useFavourites } from '../hooks/useFavourites'
import { parseDescription } from '../utils/parseDescription'
import { pickMealSuggestion } from '../utils/suggestMeal'
import { DespensaSection } from './Despensa'

type Filter = 'todos' | 'completa' | 'ligeira' | 'despensa'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'completa', label: 'Completa' },
  { key: 'ligeira', label: 'Ligeira' },
  { key: 'despensa', label: 'Despensa' },
]

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" d="m21 21-4.35-4.35" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

export function Home() {
  const navigate = useNavigate()
  const { favourites } = useFavourites()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const activeFilter = (searchParams.get('filter') as Filter | null) ?? 'todos'
  const setActiveFilter = (f: Filter) => setSearchParams({ filter: f }, { replace: true })
  const [migrating, setMigrating] = useState(false)
  const [migrateProgress, setMigrateProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.all([grocy.getRecipes(), grocy.getMealPlan()])
      .then(([recipeList, plan]) => {
        if (!mounted) return
        setRecipes(recipeList)
        setMealPlan(plan)
      })
      .catch((e: Error) => { if (mounted) setError(e.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const legacyPhotoCount = recipes.filter(
    (r) => r.picture_file_name && !grocy.isWebP(r.picture_file_name)
  ).length

  async function handleMigrate() {
    setMigrating(true)
    setMigrateProgress({ done: 0, total: legacyPhotoCount })
    try {
      await grocy.migratePhotosToWebP(recipes, (done, total) => {
        setMigrateProgress({ done, total })
      })
      const updated = await grocy.getRecipes()
      setRecipes(updated)
    } finally {
      setMigrating(false)
      setMigrateProgress(null)
    }
  }

  const parsedById = useMemo(() => {
    const map = new Map<number, ReturnType<typeof parseDescription>>()
    for (const r of recipes) {
      map.set(r.id, parseDescription(r.description ?? ''))
    }
    return map
  }, [recipes])

  const isDespensa = activeFilter === 'despensa'

  const suggestion = useMemo(
    () =>
      !isDespensa && !loading
        ? pickMealSuggestion({ recipes, favourites, mealPlan })
        : null,
    [recipes, favourites, mealPlan, isDespensa, loading]
  )

  const suggestionParsed = suggestion
    ? parseDescription(suggestion.description ?? '')
    : null

  const filtered = recipes
    .filter((r) => {
      if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false
      if (activeFilter === 'todos') return true
      const parsed = parsedById.get(r.id)!
      if (activeFilter === 'completa') return parsed.category === 'Completa'
      if (activeFilter === 'ligeira') return parsed.category === 'Ligeira'
      return false // 'despensa' — no recipes
    })
    .sort((a, b) => {
      const aPortions = parsedById.get(a.id)!.portions ?? 0
      const bPortions = parsedById.get(b.id)!.portions ?? 0
      return (bPortions > 0 ? 1 : 0) - (aPortions > 0 ? 1 : 0)
    })

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="px-4 pt-12 pb-3 border-b border-nourish-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-nourish-primary flex items-center justify-center flex-shrink-0">
            <span className="text-nourish-on-primary font-bold text-lg leading-none select-none">N</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-nourish-text leading-none">Nourish</h1>
            <p className="text-nourish-text-dim text-sm mt-0.5">
              {isDespensa ? 'O que tens em casa?' : 'O que vais comer?'}
            </p>
          </div>
        </div>

        <div className="relative flex items-center mb-3">
          <span className="absolute left-3 text-nourish-text-dim pointer-events-none">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isDespensa ? 'Pesquisar produtos...' : 'Pesquisar refeições...'}
            className="w-full bg-nourish-surface-high border border-nourish-border rounded-xl pl-9 pr-9 py-2.5 text-sm text-nourish-text placeholder-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:border-transparent"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 text-nourish-text-dim">
              <XIcon />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors focus:outline-none ${
                activeFilter === key
                  ? 'bg-nourish-primary text-nourish-on-primary'
                  : 'bg-nourish-surface-high text-nourish-text-dim border border-nourish-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {!isDespensa && !loading && legacyPhotoCount > 0 && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 bg-nourish-surface border border-nourish-border rounded-xl px-4 py-3">
          <p className="text-xs text-nourish-text-dim leading-snug">
            {migrating && migrateProgress
              ? `A converter fotos… ${migrateProgress.done}/${migrateProgress.total}`
              : `${legacyPhotoCount} foto${legacyPhotoCount > 1 ? 's' : ''} no formato antigo`}
          </p>
          {!migrating && (
            <button onClick={handleMigrate} className="flex-shrink-0 text-xs font-semibold text-nourish-primary focus:outline-none">
              Converter para WebP
            </button>
          )}
        </div>
      )}

      <main className="p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        {isDespensa && <DespensaSection query={query} />}

        {!isDespensa && loading && <Spinner />}

        {!isDespensa && error && (
          <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-xl text-sm">
            Erro ao carregar refeições: {error}
          </div>
        )}

        {!isDespensa && !loading && !error && recipes.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🍽️</div>
            <p className="font-medium text-nourish-text-dim">Sem refeições ainda</p>
            <p className="text-sm text-nourish-border mt-1">Adiciona a tua primeira refeição!</p>
          </div>
        )}

        {!isDespensa && !loading && !error && recipes.length > 0 && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🔍</div>
            <p className="font-medium text-nourish-text-dim">Sem resultados</p>
            <p className="text-sm text-nourish-border mt-1">Tenta outro filtro ou pesquisa</p>
          </div>
        )}

        {!isDespensa && !loading && !error && suggestion && !query && activeFilter === 'todos' && (
          <button
            type="button"
            onClick={() => navigate(`/meal/${suggestion.id}`)}
            className="w-full mb-4 p-4 rounded-2xl bg-nourish-surface border border-nourish-primary/30 text-left active:scale-[0.99] transition-transform focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          >
            <p className="text-xs font-semibold text-nourish-primary uppercase tracking-wider mb-1">
              Sugestão de hoje
            </p>
            <p className="font-semibold text-nourish-text">{suggestion.name}</p>
            <p className="text-xs text-nourish-text-dim mt-1">
              {(suggestionParsed?.portions ?? 0) > 0
                ? `${suggestionParsed!.portions} porção${suggestionParsed!.portions! > 1 ? 'ões' : ''} pronta no frigorífico`
                : favourites.has(suggestion.id)
                  ? 'Uma das tuas favoritas'
                  : 'Boa escolha para hoje'}
            </p>
          </button>
        )}

        {!isDespensa && !loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((r) => (
              <MealCard key={r.id} recipe={r} showPortions />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
