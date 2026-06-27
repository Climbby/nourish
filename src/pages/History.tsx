import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import { fetchSupermarketVisits, type SupermarketVisit } from '../api/homelabMetrics'
import type { MealPlanEntry, Recipe } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { BottomNav } from '../components/BottomNav'
import { VisitCarSheet } from '../components/VisitCarSheet'
import { VisitDateTime } from '../components/VisitDateTime'
import { useCars } from '../hooks/useCars'
import { useFuelPrices } from '../hooks/useFuelPrices'
import { autoLinkUnlinkedVisitCars } from '../utils/autoLinkCar'
import {
  formatVisitDuration,
  formatVisitMonthYear,
  visitMonthYearKey,
  visitStatusLabel,
} from '../utils/supermarketVisits'
import {
  fetchVisitReceipts,
  receiptMapByVisit,
  type VisitReceiptLink,
} from '../utils/visitReceipts'
import {
  supermarketLabelForVisit,
} from '../utils/visitSupermarketLabel'
import { fetchSupermarkets, type TrackedSupermarket } from '../utils/supermarkets'
import {
  fetchVisitCars,
  visitCarMap,
  type VisitCarLink,
} from '../utils/visitCars'
import { carDisplayName } from '../utils/carDisplayName'
import { formatVisitTotalCost } from '../utils/visitVisitCost'
import { visitTripCostEur } from '../utils/visitTripCost'

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

function CarIcon({ active }: { active?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 17h14M6 17l-2-5h16l-2 5M7 11l1.5-4h7L17 11M8 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      {active && <circle cx="18" cy="6" r="3" className="fill-nourish-primary stroke-none" />}
    </svg>
  )
}

function ReceiptIcon({ active }: { active?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21 8 19.5 6 21V3Z" />
      <path strokeLinecap="round" d="M9 8h6M9 12h6" />
      {active && <circle cx="18" cy="6" r="3" className="fill-nourish-primary stroke-none" />}
    </svg>
  )
}

type HistoryTab = 'meals' | 'supermarket'

function historyTabFromSearch(searchParams: URLSearchParams): HistoryTab | null {
  const tab = searchParams.get('tab')
  if (tab === 'supermarket' || tab === 'meals') return tab
  return null
}

const STORE_LABELS: Record<string, string> = {
  mixed: 'Misto',
  continente: 'Continente',
  auchan: 'Auchan',
}

function receiptSummary(receipt: VisitReceiptLink, omitPrice = false): string {
  const store = receipt.store ? STORE_LABELS[receipt.store] ?? receipt.store : null
  const parts = [
    `${receipt.item_count} produto${receipt.item_count !== 1 ? 's' : ''}`,
    !omitPrice && receipt.total_eur > 0 ? `€${receipt.total_eur.toFixed(2)}` : null,
    store,
  ].filter(Boolean)
  return parts.join(' · ')
}

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
  const [searchParams, setSearchParams] = useSearchParams()
  const stateTab = (location.state as { tab?: HistoryTab } | null)?.tab
  const tab = historyTabFromSearch(searchParams) ?? (stateTab === 'supermarket' ? 'supermarket' : 'meals')

  function setTab(next: HistoryTab) {
    if (next === 'supermarket') {
      setSearchParams({ tab: 'supermarket' }, { replace: true })
      return
    }
    setSearchParams({}, { replace: true })
  }

  useEffect(() => {
    if (stateTab === 'supermarket' && searchParams.get('tab') !== 'supermarket') {
      setSearchParams({ tab: 'supermarket' }, { replace: true })
    }
  }, [stateTab, searchParams, setSearchParams])
  const [entries, setEntries] = useState<MealPlanEntry[]>([])
  const [recipes, setRecipes] = useState<Record<number, Recipe>>({})
  const [visits, setVisits] = useState<SupermarketVisit[] | null>(null)
  const [visitsError, setVisitsError] = useState(false)
  const [visitReceipts, setVisitReceipts] = useState<VisitReceiptLink[]>([])
  const [visitCars, setVisitCars] = useState<VisitCarLink[]>([])
  const [trackedSupermarkets, setTrackedSupermarkets] = useState<TrackedSupermarket[]>([])
  const [carSheetVisit, setCarSheetVisit] = useState<SupermarketVisit | null>(null)
  const { cars, refreshCars } = useCars()
  const { priceForCar } = useFuelPrices()
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
    Promise.all([
      fetchSupermarketVisits(180),
      fetchVisitReceipts(),
      fetchVisitCars(),
      fetchSupermarkets(),
    ]).then(([list, receipts, carLinks, supermarkets]) => {
        if (!mounted) return
        if (list === null) setVisitsError(true)
        else setVisits(list)
        setVisitReceipts(receipts)
        setVisitCars(carLinks)
        setTrackedSupermarkets(supermarkets?.tracked ?? [])
      })
    return () => { mounted = false }
  }, [tab])

  useEffect(() => {
    if (tab !== 'supermarket' || !visits?.length || cars.length === 0) return
    let mounted = true
    void (async () => {
      const added = await autoLinkUnlinkedVisitCars(visits, cars, visitCars, priceForCar)
      if (!mounted || added.length === 0) return
      setVisitCars((prev) => {
        const map = visitCarMap(prev)
        for (const link of added) map.set(link.visit_entered_at, link)
        return [...map.values()]
      })
    })()
    return () => { mounted = false }
  }, [tab, visits, cars, visitCars, priceForCar])

  const receiptByVisit = receiptMapByVisit(visitReceipts)
  const carByVisit = visitCarMap(visitCars)
  const carsById = useMemo(() => new Map(cars.map((c) => [c.id, c])), [cars])

  useEffect(() => {
    if (tab === 'supermarket') {
      refreshCars()
    }
  }, [tab, refreshCars])

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
                const key = visitMonthYearKey(v.entered_at)
                acc[key] = acc[key] ?? []
                acc[key].push(v)
                return acc
              }, {})
            )
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([monthKey, monthVisits]) => (
                <div key={monthKey}>
                  <h2 className="text-xs font-semibold text-nourish-text-dim tracking-wider uppercase mb-2">
                    {formatVisitMonthYear(monthVisits[0].entered_at)}
                  </h2>
                  <div className="space-y-2">
                    {monthVisits.map((visit) => {
                      const statusLabel = visitStatusLabel(visit)
                      const carLink = carByVisit.get(visit.entered_at)
                      const car = carLink ? carsById.get(carLink.car_id) : undefined
                      const receipt = receiptByVisit.get(visit.entered_at)
                      const supermarketName = supermarketLabelForVisit(visit, trackedSupermarkets)
                      const fuelCost = visitTripCostEur(carLink, visit, car)
                      const totalCost = formatVisitTotalCost(receipt, fuelCost)

                      return (
                      <div
                        key={visit.entered_at}
                        className="p-3 bg-nourish-surface border border-nourish-border rounded-2xl"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <VisitDateTime visit={visit} supermarketName={supermarketName} />
                            {statusLabel && (
                              <p className="text-xs text-nourish-text-dim mt-0.5">{statusLabel}</p>
                            )}
                            {receipt && (
                              <p className="text-xs text-nourish-text-dim mt-0.5 truncate">
                                Talão: {receiptSummary(receipt, !!totalCost)}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end shrink-0 gap-1">
                            {totalCost && (
                              <>
                                <span className="text-sm font-bold tabular-nums text-nourish-text">
                                  {totalCost.main}
                                </span>
                                {totalCost.detail && (
                                  <span className="text-[10px] text-nourish-text-dim tabular-nums text-right leading-tight max-w-[9rem]">
                                    {totalCost.detail}
                                  </span>
                                )}
                              </>
                            )}
                            <span
                              className={`text-xs font-bold tabular-nums ${
                                visit.ongoing ? 'text-nourish-primary' : 'text-nourish-text-dim'
                              }`}
                            >
                              {formatVisitDuration(visit.duration_minutes, visit.ongoing)}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <button
                                type="button"
                                onClick={() => setCarSheetVisit(visit)}
                                title={car ? carDisplayName(car, cars) : 'Viatura'}
                                className={`p-1.5 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                                  car
                                    ? 'border-nourish-primary/40 bg-nourish-primary/10 text-nourish-primary'
                                    : 'border-nourish-border bg-nourish-surface-high text-nourish-text-dim'
                                }`}
                                aria-label={car ? `Viatura: ${carDisplayName(car, cars)}` : 'Escolher viatura'}
                              >
                                <CarIcon active={!!car} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`/receipt?visit=${encodeURIComponent(visit.entered_at)}`)
                                }
                                title={receipt ? 'Substituir talão' : 'Adicionar talão'}
                                className={`p-1.5 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                                  receipt
                                    ? 'border-nourish-primary/40 bg-nourish-primary/10 text-nourish-primary'
                                    : 'border-nourish-border bg-nourish-surface-high text-nourish-text-dim'
                                }`}
                                aria-label={receipt ? 'Talão associado' : 'Adicionar talão'}
                              >
                                <ReceiptIcon active={!!receipt} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )})}
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

      {carSheetVisit && (
        <VisitCarSheet
          visit={carSheetVisit}
          cars={cars}
          supermarketName={supermarketLabelForVisit(carSheetVisit, trackedSupermarkets)}
          currentLink={carByVisit.get(carSheetVisit.entered_at)}
          onClose={() => setCarSheetVisit(null)}
          onSaved={(link) => {
            setVisitCars((prev) => {
              const next = prev.filter((l) => l.visit_entered_at !== carSheetVisit.entered_at)
              if (link) next.push(link)
              return next
            })
          }}
        />
      )}

      <BottomNav />
    </div>
  )
}
