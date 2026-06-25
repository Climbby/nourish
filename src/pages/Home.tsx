import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { Recipe } from '../types/grocy'
import { MealCard } from '../components/MealCard'
import { Spinner } from '../components/Spinner'
import { BottomNav } from '../components/BottomNav'
import { useDisplayPrefs } from '../hooks/useDisplayPrefs'
import { useFavourites } from '../hooks/useFavourites'
import { parseDescription } from '../utils/parseDescription'
import {
  mealMatchesVerificationFilters,
  type VerificationFilterKey,
} from '../utils/mealVerificationFilter'
import { MEAL_SORT_OPTIONS, sortRecipes } from '../utils/mealSort'
import { DespensaSection } from './Despensa'

type Filter = 'completa' | 'ligeira' | 'despensa'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'completa', label: 'Completa' },
  { key: 'ligeira', label: 'Ligeira' },
  { key: 'despensa', label: 'Despensa' },
]

function parseFilter(raw: string | null): Filter {
  if (raw === 'ligeira' || raw === 'despensa') return raw
  return 'completa'
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" d="m21 21-4.35-4.35" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7v5l3 2" />
    </svg>
  )
}

function HeartIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      className="w-4 h-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
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

function FilterIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path strokeLinecap="round" d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

function SortIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </svg>
  )
}

const VERIFICATION_FILTERS: { key: VerificationFilterKey; label: string }[] = [
  { key: 'preco', label: 'Preço verificado' },
  { key: 'nutricao', label: 'Nutrição verificada' },
  { key: 'unverified', label: 'Não verificado' },
]

export function Home() {
  const navigate = useNavigate()
  const { favourites } = useFavourites()
  const { prefs, updatePref } = useDisplayPrefs()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const activeFilter = parseFilter(searchParams.get('filter'))
  const setActiveFilter = (f: Filter) => setSearchParams({ filter: f }, { replace: true })
  const [migrating, setMigrating] = useState(false)
  const [migrateProgress, setMigrateProgress] = useState<{ done: number; total: number } | null>(null)
  const [showVerificationFilters, setShowVerificationFilters] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [verificationFilters, setVerificationFilters] = useState<Set<VerificationFilterKey>>(new Set())
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showVerificationFilters) return
    function onPointerDown(e: PointerEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowVerificationFilters(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [showVerificationFilters])

  useEffect(() => {
    if (!showSortMenu) return
    function onPointerDown(e: PointerEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [showSortMenu])

  function toggleVerificationFilter(key: VerificationFilterKey) {
    setVerificationFilters((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    let mounted = true
    grocy.getRecipes()
      .then((recipeList) => {
        if (!mounted) return
        setRecipes(recipeList)
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

  const filtered = useMemo(() => {
    const list = recipes.filter((r) => {
      if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false
      if (favouritesOnly && !favourites.has(r.id)) return false
      const parsed = parsedById.get(r.id)!
      if (activeFilter === 'completa' && parsed.category !== 'Completa') return false
      if (activeFilter === 'ligeira' && parsed.category !== 'Ligeira') return false
      if (!mealMatchesVerificationFilters(parsed, verificationFilters)) return false
      return activeFilter === 'completa' || activeFilter === 'ligeira'
    })
    return sortRecipes(list, parsedById, prefs.mealSort)
  }, [recipes, query, favouritesOnly, favourites, parsedById, activeFilter, verificationFilters, prefs.mealSort])

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="px-4 pt-12 pb-3 border-b border-nourish-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-nourish-primary flex items-center justify-center flex-shrink-0">
            <span className="text-nourish-on-primary font-bold text-lg leading-none select-none">N</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-nourish-text leading-none">Nourish</h1>
            <p className="text-nourish-text-dim text-sm mt-0.5">
              {isDespensa ? 'O que tens em casa?' : 'O que vais comer?'}
            </p>
          </div>
          {!isDespensa && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => navigate('/history')}
                className="p-2.5 rounded-lg bg-nourish-surface-high border border-nourish-border text-nourish-text-dim active:bg-nourish-border/20 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                aria-label="Historial"
              >
                <ClockIcon />
              </button>
              <button
                type="button"
                onClick={() => navigate('/plan')}
                className="p-2.5 rounded-lg bg-nourish-surface-high border border-nourish-border text-nourish-text-dim active:bg-nourish-border/20 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                aria-label="Plano da semana"
              >
                <CalendarIcon />
              </button>
            </div>
          )}
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

        <div className="flex items-center gap-2">
          <div className="flex gap-2 overflow-x-auto pb-0.5 flex-1 min-w-0" style={{ scrollbarWidth: 'none' }}>
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
          {!isDespensa && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="relative" ref={sortRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSortMenu((v) => !v)
                    setShowVerificationFilters(false)
                  }}
                  className={`p-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                    prefs.mealSort !== 'recent'
                      ? 'bg-nourish-primary/15 border-nourish-primary/40 text-nourish-primary'
                      : 'bg-nourish-surface-high border-nourish-border text-nourish-text-dim'
                  }`}
                  aria-label="Ordenar refeições"
                  aria-expanded={showSortMenu}
                >
                  <SortIcon />
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-2 z-20 w-48 rounded-xl border border-nourish-border bg-nourish-surface shadow-lg p-2 space-y-0.5">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-nourish-text-dim">
                      Ordenar
                    </p>
                    {MEAL_SORT_OPTIONS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          updatePref('mealSort', key)
                          setShowSortMenu(false)
                        }}
                        className={`w-full text-left px-2 py-2 rounded-lg text-sm transition-colors focus:outline-none ${
                          prefs.mealSort === key
                            ? 'bg-nourish-primary/15 text-nourish-primary font-semibold'
                            : 'text-nourish-text active:bg-nourish-surface-high'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowVerificationFilters((v) => !v)
                    setShowSortMenu(false)
                  }}
                  className={`p-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                    verificationFilters.size > 0 || favouritesOnly
                      ? 'bg-nourish-primary/15 border-nourish-primary/40 text-nourish-primary'
                      : 'bg-nourish-surface-high border-nourish-border text-nourish-text-dim'
                  }`}
                  aria-label="Filtros de verificação"
                  aria-expanded={showVerificationFilters}
                >
                  <FilterIcon />
                </button>
                {showVerificationFilters && (
                  <div className="absolute right-0 top-full mt-2 z-20 w-52 rounded-xl border border-nourish-border bg-nourish-surface shadow-lg p-2 space-y-1">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-nourish-text-dim">
                      Filtros
                    </p>
                    <label className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-nourish-text cursor-pointer active:bg-nourish-surface-high">
                      <input
                        type="checkbox"
                        checked={favouritesOnly}
                        onChange={() => setFavouritesOnly((v) => !v)}
                        className="rounded border-nourish-border"
                      />
                      <HeartIcon filled={favouritesOnly} />
                      Favoritos
                    </label>
                    <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-nourish-text-dim">
                      Verificação
                    </p>
                    {VERIFICATION_FILTERS.map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-nourish-text cursor-pointer active:bg-nourish-surface-high"
                      >
                        <input
                          type="checkbox"
                          checked={verificationFilters.has(key)}
                          onChange={() => toggleVerificationFilter(key)}
                          className="rounded border-nourish-border"
                        />
                        {label}
                      </label>
                    ))}
                    {(verificationFilters.size > 0 || favouritesOnly) && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerificationFilters(new Set())
                          setFavouritesOnly(false)
                        }}
                        className="w-full px-2 py-1.5 text-xs text-nourish-text-dim underline"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
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

        {!isDespensa && !loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((r) => (
              <MealCard key={r.id} recipe={r} showPortions={prefs.showMealPortions} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
