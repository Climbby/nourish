import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { grocy } from '../api/grocy'
import { fetchSupermarketVisits, type SupermarketVisit } from '../api/homelabMetrics'
import type { MealPlanEntry, Recipe } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { BottomNav } from '../components/BottomNav'
import { formatVisitDuration } from '../utils/supermarketVisits'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDay(day: string): string {
  const today = todayStr()
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (day === today) return 'Hoje'
  if (day === yesterday) return 'Ontem'
  const [y, m, dd] = day.split('-').map(Number)
  return new Date(y, m - 1, dd).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(ts: string): string {
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'))
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatVisitDay(iso: string): string {
  const d = new Date(iso)
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return formatDay(day)
}

type HistoryTab = 'meals' | 'supermarket'

function mealType(ts: string): 'Almoço' | 'Jantar' {
  return new Date(ts.replace(' ', 'T')).getHours() < 17 ? 'Almoço' : 'Jantar'
}

const MERGE_WINDOW_MS = 30 * 60 * 1000

interface EntryGroup {
  entry: MealPlanEntry
  count: number
  allIds: number[]
}

function groupByRecipe(entries: MealPlanEntry[]): EntryGroup[] {
  const result: EntryGroup[] = []
  for (const entry of entries) {
    const last = result[result.length - 1]
    if (
      last &&
      last.entry.recipe_id === entry.recipe_id &&
      last.entry.row_created_timestamp &&
      entry.row_created_timestamp
    ) {
      const dt =
        Math.abs(
          new Date(entry.row_created_timestamp.replace(' ', 'T')).getTime() -
          new Date(last.entry.row_created_timestamp.replace(' ', 'T')).getTime()
        )
      if (dt <= MERGE_WINDOW_MS) {
        last.count++
        last.allIds.push(entry.id)
        continue
      }
    }
    result.push({ entry, count: 1, allIds: [entry.id] })
  }
  return result
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.499.058l.346-9Z" clipRule="evenodd" />
    </svg>
  )
}

export function History() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialTab =
    (location.state as { tab?: HistoryTab } | null)?.tab === 'supermarket' ? 'supermarket' : 'meals'
  const [tab, setTab] = useState<HistoryTab>(initialTab)
  const [entries, setEntries] = useState<MealPlanEntry[]>([])
  const [recipes, setRecipes] = useState<Record<number, Recipe>>({})
  const [visits, setVisits] = useState<SupermarketVisit[] | null>(null)
  const [visitsError, setVisitsError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.all([grocy.getMealPlan(), grocy.getRecipes()])
      .then(([plan, recipeList]) => {
        if (!mounted) return
        setEntries([...plan].sort((a, b) =>
          b.day !== a.day
            ? b.day.localeCompare(a.day)
            : (b.row_created_timestamp ?? '').localeCompare(a.row_created_timestamp ?? '')
        ))
        setRecipes(Object.fromEntries(recipeList.map((r) => [r.id, r])))
      })
      .catch((e: Error) => { if (mounted) setError(e.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (tab !== 'supermarket') return
    let mounted = true
    setVisits(null)
    setVisitsError(false)
    fetchSupermarketVisits(180).then((list) => {
      if (!mounted) return
      if (list === null) setVisitsError(true)
      else setVisits(list)
    })
    return () => { mounted = false }
  }, [tab])

  // Group by date
  const grouped = entries.reduce<Record<string, MealPlanEntry[]>>((acc, entry) => {
    acc[entry.day] = acc[entry.day] ?? []
    acc[entry.day].push(entry)
    return acc
  }, {})

  const days = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="px-4 pt-12 pb-4 border-b border-nourish-border">
        <h1 className="text-2xl font-bold text-nourish-text">Historial</h1>
        <p className="text-nourish-text-dim text-sm mt-0.5">
          {tab === 'meals' ? 'O que comeste' : 'Idas ao supermercado'}
        </p>
        <div className="flex gap-2 mt-4 p-1 rounded-xl bg-nourish-bg border border-nourish-border">
          <button
            type="button"
            onClick={() => setTab('meals')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
              tab === 'meals'
                ? 'bg-nourish-surface text-nourish-text shadow-sm'
                : 'text-nourish-text-dim'
            }`}
          >
            Refeições
          </button>
          <button
            type="button"
            onClick={() => setTab('supermarket')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
              tab === 'supermarket'
                ? 'bg-nourish-surface text-nourish-text shadow-sm'
                : 'text-nourish-text-dim'
            }`}
          >
            Supermercado
          </button>
        </div>
      </header>

      <main className="p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        {tab === 'meals' && loading && <Spinner />}

        {tab === 'meals' && error && (
          <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-xl text-sm">
            Erro ao carregar: {error}
          </div>
        )}

        {tab === 'supermarket' && visits === null && !visitsError && <Spinner />}

        {tab === 'supermarket' && visitsError && (
          <div className="p-3 bg-amber-900/30 border border-amber-800 text-amber-200 rounded-xl text-sm">
            Não foi possível carregar visitas. Confirma que o servidor homelab está activo e que entras/saí
            da zona do super no Home Assistant.
          </div>
        )}

        {tab === 'supermarket' && visits && visits.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🛒</div>
            <p className="font-medium text-nourish-text-dim">Sem visitas registadas</p>
            <p className="text-sm text-nourish-border mt-1 max-w-xs mx-auto leading-snug">
              Ao entrares e saíres da zona do super no Home Assistant, as idas aparecem aqui com hora e duração.
            </p>
          </div>
        )}

        {tab === 'supermarket' && visits && visits.length > 0 && (
          <div className="space-y-6">
            {Object.entries(
              visits.reduce<Record<string, SupermarketVisit[]>>((acc, v) => {
                const day = v.entered_at.slice(0, 10)
                acc[day] = acc[day] ?? []
                acc[day].push(v)
                return acc
              }, {})
            )
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([day, dayVisits]) => (
                <div key={day}>
                  <h2 className="text-xs font-semibold text-nourish-text-dim tracking-wider uppercase mb-2">
                    {formatVisitDay(dayVisits[0].entered_at)}
                  </h2>
                  <div className="space-y-2">
                    {dayVisits.map((visit) => (
                      <div
                        key={visit.entered_at}
                        className="p-4 bg-nourish-surface border border-nourish-border rounded-2xl"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-nourish-text tabular-nums">
                              {formatTime(visit.entered_at)}
                              {visit.left_at && (
                                <span className="text-nourish-text-dim font-normal">
                                  {' '}
                                  → {formatTime(visit.left_at)}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-nourish-text-dim mt-1">
                              {visit.ongoing
                                ? 'Entrada registada — ainda no super'
                                : visit.left_at
                                  ? 'Entrada e saída'
                                  : 'Saída não registada'}
                            </p>
                          </div>
                          <span
                            className={`text-sm font-bold tabular-nums shrink-0 ${
                              visit.ongoing ? 'text-nourish-primary' : 'text-nourish-text'
                            }`}
                          >
                            {formatVisitDuration(visit.duration_minutes, visit.ongoing)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {tab === 'meals' && !loading && !error && days.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-medium text-nourish-text-dim">Sem registos ainda</p>
            <p className="text-sm text-nourish-border mt-1">Toca em "Registar" numa refeição para começar</p>
          </div>
        )}

        {tab === 'meals' && !loading && days.length > 0 && (
          <div className="space-y-6">
            {days.map((day) => (
              <div key={day}>
                <h2 className="text-xs font-semibold text-nourish-text-dim tracking-wider uppercase mb-2">
                  {formatDay(day)}
                </h2>
                <div className="space-y-2">
                  {groupByRecipe(grouped[day]).map((group) => {
                    const { entry, count, allIds } = group
                    const recipe = recipes[entry.recipe_id]
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 bg-nourish-surface border border-nourish-border rounded-2xl overflow-hidden"
                      >
                        <button
                          onClick={() => navigate(`/meal/${entry.recipe_id}`)}
                          className="flex items-center gap-3 p-3 text-left flex-1 min-w-0 active:bg-nourish-surface-high transition-colors focus:outline-none"
                        >
                          <div className="relative flex-shrink-0">
                            {recipe?.picture_file_name ? (
                              <img
                                src={grocy.pictureUrl(recipe.picture_file_name)}
                                alt={recipe.name}
                                className="w-14 h-14 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-nourish-surface-high flex items-center justify-center text-2xl">
                                🍽️
                              </div>
                            )}
                            {count > 1 && (
                              <span className="absolute -top-1 -right-1 bg-nourish-primary text-nourish-on-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                                ×{count}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-nourish-text text-sm truncate">
                              {recipe?.name ?? `Refeição ${entry.recipe_id}`}
                            </p>
                            {entry.row_created_timestamp && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-nourish-primary font-medium">
                                  {mealType(entry.row_created_timestamp)}
                                </span>
                                <span className="text-nourish-border text-xs">·</span>
                                <span className="text-xs text-nourish-text-dim tabular-nums">
                                  {formatTime(entry.row_created_timestamp)}
                                </span>
                              </div>
                            )}
                            {entry.note && (
                              <p className="text-xs text-nourish-text-dim mt-0.5 truncate">{entry.note}</p>
                            )}
                          </div>
                        </button>
                        <button
                          onClick={async () => {
                            const removed = entries.filter((e) => allIds.includes(e.id))
                            setEntries((prev) => prev.filter((e) => !allIds.includes(e.id)))
                            try {
                              await Promise.all(allIds.map((id) => grocy.deleteMealPlanEntry(id)))
                            } catch {
                              setEntries((prev) =>
                                [...prev, ...removed].sort((a, b) =>
                                  b.day !== a.day
                                    ? b.day.localeCompare(a.day)
                                    : (b.row_created_timestamp ?? '').localeCompare(a.row_created_timestamp ?? '')
                                )
                              )
                            }
                          }}
                          className="p-3 pr-4 text-nourish-border hover:text-red-400 transition-colors flex-shrink-0 focus:outline-none"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
