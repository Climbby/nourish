import { useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { MealPlanEntry, Recipe } from '../types/grocy'
import { BottomNav } from '../components/BottomNav'
import { ConnectionError } from '../components/ConnectionError'
import { CarModelInput } from '../components/CarModelInput'
import { MealSpendSheet } from '../components/MealSpendSheet'
import { VisitFuelTripsSheet } from '../components/VisitFuelTripsSheet'
import { VisitShoppingTripsSheet } from '../components/VisitShoppingTripsSheet'
import { NumericInput } from '../components/NumericInput'
import { Spinner } from '../components/Spinner'
import { useDisplayPrefs } from '../hooks/useDisplayPrefs'
import { useCars, type Car } from '../hooks/useCars'
import { useFuelPrices } from '../hooks/useFuelPrices'
import { useNutritionTargets, DEFAULT_TARGETS } from '../hooks/useNutritionTargets'
import type { FuelType } from '../utils/fuelPrices'
import { FUEL_TYPE_OPTIONS, formatFuelPricesUpdatedAt } from '../utils/fuelPrices'
import {
  fetchSupermarkets,
  removeTracked,
  unblockPlace,
  type SupermarketsData,
} from '../utils/supermarkets'
import { useUserProfile, DEFAULT_USER_PROFILE } from '../hooks/useUserProfile'
import { clearPwaCachesAndReload, nudgeServiceWorkerUpdate } from '../utils/pwaRecovery'
import {
  aggregateMealStats,
  buildMealSpendRows,
  filterMealPlanByPeriod,
  getPeriodMeta,
  macroGaps,
  macroSurpluses,
  SURPLUS_ADVICE,
  type StatsPeriod,
} from '../utils/mealStats'
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  profileSummary,
  recommendedDailyTargets,
} from '../utils/nutritionRecommendations'
import {
  defaultDaysUntilShop,
  fetchHomelabMetrics,
  fetchSupermarketVisits,
  hasShopIntervalMedian,
  shopIntervalDays,
  type HomelabMetrics,
  type SupermarketVisit,
} from '../api/homelabMetrics'
import { fetchVisitCars, type VisitCarLink } from '../utils/visitCars'
import { fetchVisitReceipts, type VisitReceiptLink } from '../utils/visitReceipts'
import {
  aggregateVisitSpend,
  buildVisitFuelTrips,
  buildVisitShoppingTrips,
  filterVisitsByPeriod,
} from '../utils/visitSpendStats'
import { supermarketLabelForVisit } from '../utils/visitSupermarketLabel'

const PERIODS: { key: StatsPeriod; short: string }[] = [
  { key: '7d', short: '7 dias' },
  { key: '30d', short: '30 dias' },
  { key: 'month', short: 'Mês' },
]

type ProfileTab = 'resumo' | 'objectivos' | 'viaturas' | 'definicoes'

const PROFILE_TABS: { key: ProfileTab; label: string; subtitle: string }[] = [
  { key: 'resumo', label: 'Resumo', subtitle: 'Gastos e macros no período' },
  { key: 'objectivos', label: 'Objectivos', subtitle: 'Metas diárias e dados pessoais' },
  { key: 'viaturas', label: 'Viaturas', subtitle: 'Km e custo das idas ao super' },
  { key: 'definicoes', label: 'Casa', subtitle: 'Aparência e supermercado' },
]

const inputClass =
  'w-full px-3 py-2 bg-nourish-surface border border-nourish-border rounded-xl text-nourish-text text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary'

const spendCardClass =
  'text-left bg-nourish-surface border border-nourish-border rounded-2xl p-4 transition-colors hover:border-nourish-primary/40 focus:outline-none focus:ring-2 focus:ring-nourish-primary disabled:opacity-60'

export function Profile() {
  const location = useLocation()
  const initialTab = (location.state as { tab?: ProfileTab } | null)?.tab ?? 'resumo'
  const { targets, setTargets, resetTargets } = useNutritionTargets()
  const { profile, updateField } = useUserProfile()
  const { prefs, updatePref } = useDisplayPrefs()
  const { cars, addCar, updateCar, removeCar, refreshCars } = useCars()
  const { prices: fuelPrices, refresh: refreshFuel } = useFuelPrices()
  const [tab, setTab] = useState<ProfileTab>(initialTab)
  const [period, setPeriod] = useState<StatsPeriod>('7d')
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTargets, setShowTargets] = useState(false)
  const [showBody, setShowBody] = useState(false)
  const [homelabMetrics, setHomelabMetrics] = useState<HomelabMetrics | null>(null)
  const [homelabMetricsError, setHomelabMetricsError] = useState(false)
  const [supermarkets, setSupermarkets] = useState<SupermarketsData | null>(null)
  const [supermarketVisits, setSupermarketVisits] = useState<SupermarketVisit[]>([])
  const [visitCars, setVisitCars] = useState<VisitCarLink[]>([])
  const [visitReceipts, setVisitReceipts] = useState<VisitReceiptLink[]>([])
  const [visitSpendLoading, setVisitSpendLoading] = useState(true)
  const [showFuelTripsSheet, setShowFuelTripsSheet] = useState(false)
  const [showShoppingTripsSheet, setShowShoppingTripsSheet] = useState(false)
  const [showMealSpendSheet, setShowMealSpendSheet] = useState(false)

  const refreshSupermarkets = useCallback(() => {
    void fetchSupermarkets().then(setSupermarkets)
  }, [])

  useEffect(() => {
    fetchHomelabMetrics().then((m) => {
      setHomelabMetrics(m)
      setHomelabMetricsError(m === null)
    })
    refreshCars()
    refreshFuel()
    refreshSupermarkets()
    setVisitSpendLoading(true)
    Promise.all([
      fetchSupermarketVisits(90),
      fetchVisitCars(),
      fetchVisitReceipts(),
    ])
      .then(([visits, carLinks, receipts]) => {
        setSupermarketVisits(visits ?? [])
        setVisitCars(carLinks)
        setVisitReceipts(receipts)
      })
      .finally(() => setVisitSpendLoading(false))
  }, [refreshCars, refreshFuel, refreshSupermarkets])

  useEffect(() => {
    if (tab === 'definicoes') refreshSupermarkets()
  }, [tab, refreshSupermarkets])

  const recommended = useMemo(() => recommendedDailyTargets(profile), [profile])
  const fuelPricesUpdatedLabel = fuelPrices
    ? formatFuelPricesUpdatedAt(fuelPrices.updated_at)
    : null

  const loadProfile = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([grocy.getMealPlan(), grocy.getRecipes()])
      .then(([plan, list]) => {
        setMealPlan(plan)
        setRecipes(list)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const periodMeta = getPeriodMeta(period)
  const resumoPeriodLabel =
    period === 'month' ? periodMeta.label : periodMeta.label.toLowerCase()
  const periodEntries = useMemo(
    () => filterMealPlanByPeriod(mealPlan, period),
    [mealPlan, period]
  )
  const recipesById = useMemo(
    () => Object.fromEntries(recipes.map((r) => [r.id, r])),
    [recipes]
  )
  const totals = useMemo(
    () => aggregateMealStats(periodEntries, recipesById),
    [periodEntries, recipesById]
  )
  const gaps = useMemo(
    () => macroGaps(totals, targets, periodMeta.dayCount),
    [totals, targets, periodMeta.dayCount]
  )
  const surpluses = useMemo(
    () => macroSurpluses(totals, targets, periodMeta.dayCount),
    [totals, targets, periodMeta.dayCount]
  )
  const surplusKeys = useMemo(() => new Set(surpluses.map((s) => s.key)), [surpluses])

  const carsById = useMemo(() => new Map(cars.map((c) => [c.id, c])), [cars])
  const visitsInPeriod = useMemo(
    () => filterVisitsByPeriod(supermarketVisits, period),
    [supermarketVisits, period]
  )
  const visitSpend = useMemo(() => {
    return aggregateVisitSpend(visitsInPeriod, visitCars, visitReceipts, carsById)
  }, [visitsInPeriod, visitCars, visitReceipts, carsById])
  const destinationForVisit = useCallback(
    (visit: SupermarketVisit) =>
      supermarketLabelForVisit(visit, supermarkets?.tracked ?? []),
    [supermarkets?.tracked]
  )
  const fuelTrips = useMemo(
    () => buildVisitFuelTrips(visitsInPeriod, visitCars, carsById, destinationForVisit),
    [visitsInPeriod, visitCars, carsById, destinationForVisit]
  )
  const shoppingTrips = useMemo(
    () => buildVisitShoppingTrips(visitsInPeriod, visitReceipts, destinationForVisit, visitCars),
    [visitsInPeriod, visitReceipts, destinationForVisit, visitCars]
  )
  const mealSpendRows = useMemo(
    () => buildMealSpendRows(periodEntries, recipesById),
    [periodEntries, recipesById]
  )

  const [showCarForm, setShowCarForm] = useState(false)
  const [carDraft, setCarDraft] = useState<Omit<Car, 'id'>>({
    name: '',
    consumption_l100km: 6,
    fuel_type: 'diesel',
  })

  function handleAddCar() {
    const name = carDraft.name.trim()
    if (!name) return
    addCar(carDraft)
    setCarDraft({
      name: '',
      consumption_l100km: 6,
      fuel_type: 'diesel',
    })
    setShowCarForm(false)
  }

  const avgPerDay = periodMeta.dayCount > 0
    ? {
        calories: Math.round(totals.calories / periodMeta.dayCount),
        protein: Math.round(totals.protein / periodMeta.dayCount),
      }
    : null

  const activeTabMeta = PROFILE_TABS.find((t) => t.key === tab)!

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="px-4 pt-12 pb-3 border-b border-nourish-border">
        <h1 className="text-2xl font-bold text-nourish-text">Perfil</h1>
        <p className="text-nourish-text-dim text-sm mt-0.5">{activeTabMeta.subtitle}</p>
        <div
          className="flex gap-2 mt-4 overflow-x-auto pb-0.5"
          style={{ scrollbarWidth: 'none' }}
        >
          {PROFILE_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                tab === key
                  ? 'bg-nourish-primary text-nourish-on-primary'
                  : 'bg-nourish-surface-high text-nourish-text-dim border border-nourish-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 space-y-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}>
        {tab === 'resumo' && (
          <div className="flex gap-2">
            {PERIODS.map(({ key, short }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                  period === key
                    ? 'bg-nourish-primary text-nourish-on-primary border-nourish-primary'
                    : 'bg-nourish-surface border-nourish-border text-nourish-text-dim'
                }`}
              >
                {short}
              </button>
            ))}
          </div>
        )}

        {loading && <Spinner />}

        {error && (
          <ConnectionError message={`Erro ao carregar: ${error}`} onRetry={loadProfile} />
        )}

        {!loading && !error && tab === 'resumo' && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-nourish-primary tracking-wide">
                Resumo · {resumoPeriodLabel}
              </h2>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowShoppingTripsSheet(true)}
                  disabled={visitSpendLoading}
                  className={spendCardClass}
                >
                  <p className="text-2xl font-bold text-nourish-text tabular-nums">
                    €{visitSpend.shoppingEur.toFixed(2)}
                  </p>
                  <p className="text-sm text-nourish-text-dim mt-0.5 leading-snug">
                    Compras no super
                  </p>
                  <p className="text-[11px] text-nourish-border mt-1.5 leading-snug">
                    {visitSpendLoading
                      ? 'A carregar…'
                      : visitSpend.visitsInPeriod > 0
                        ? `${visitSpend.visitsWithReceipt > 0 ? `${visitSpend.visitsWithReceipt} talão${visitSpend.visitsWithReceipt !== 1 ? 's' : ''} · ` : ''}ver detalhes`
                        : 'Sem idas registadas no período'}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFuelTripsSheet(true)}
                  disabled={visitSpendLoading}
                  className={spendCardClass}
                >
                  <p className="text-2xl font-bold text-nourish-text tabular-nums">
                    €{visitSpend.fuelEur.toFixed(2)}
                  </p>
                  <p className="text-sm text-nourish-text-dim mt-0.5 leading-snug">
                    Viagens (combustível)
                  </p>
                  <p className="text-[11px] text-nourish-border mt-1.5 leading-snug">
                    {visitSpendLoading
                      ? 'A carregar…'
                      : visitSpend.visitsWithFuelCost > 0
                        ? `${visitSpend.visitsWithFuelCost} ida${visitSpend.visitsWithFuelCost !== 1 ? 's' : ''} com viatura · ver detalhes`
                        : visitSpend.visitsInPeriod > 0
                          ? `${visitSpend.visitsInPeriod} ida${visitSpend.visitsInPeriod !== 1 ? 's' : ''} · ver detalhes`
                          : 'Sem idas registadas no período'}
                  </p>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowMealSpendSheet(true)}
                disabled={loading}
                className={`w-full ${spendCardClass}`}
              >
                <p className="text-3xl font-bold text-nourish-text tabular-nums">
                  €{totals.spend.toFixed(2)}
                </p>
                <p className="text-sm text-nourish-text-dim mt-0.5">
                  Refeições registadas
                  {totals.mealsLogged > 0 && (
                    <> · {totals.mealsLogged} registo{totals.mealsLogged !== 1 ? 's' : ''} · ver detalhes</>
                  )}
                </p>
                {totals.mealsLogged === 0 && !loading && (
                  <p className="text-xs text-nourish-border mt-2">
                    Regista refeições em Historial para ver totais. Só contam refeições com nutrição/preço no cartão.
                  </p>
                )}
              </button>

              {surpluses.length > 0 && totals.mealsLogged > 0 && (
                <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 space-y-2">
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    Acima do objectivo
                  </p>
                  {surpluses.map((s) => (
                    <div key={s.key}>
                      <p className="text-sm font-medium text-nourish-text">
                        {s.label}: {s.percentOfExpected}% (+{Math.round(s.overBy)} {s.unit})
                      </p>
                      <p className="text-xs text-nourish-text-dim mt-0.5">{SURPLUS_ADVICE[s.key]}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {gaps.map((g) => {
                  const pctRaw = g.expected > 0 ? (g.actual / g.expected) * 100 : 0
                  const isOver = surplusKeys.has(g.key)
                  const barPct = Math.min(100, Math.round(pctRaw))
                  return (
                    <div
                      key={g.key}
                      className={`bg-nourish-surface border rounded-xl p-3 ${
                        isOver ? 'border-amber-500/50' : 'border-nourish-border'
                      }`}
                    >
                      <p className="text-xs text-nourish-text-dim">{g.label}</p>
                      <p className="text-lg font-bold text-nourish-text tabular-nums">
                        {Math.round(g.actual)}
                        <span className="text-xs font-normal text-nourish-text-dim"> {g.unit}</span>
                      </p>
                      <div className="mt-2 h-1.5 bg-nourish-surface-high rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOver ? 'bg-amber-500' : 'bg-nourish-primary'
                          }`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <p className={`text-[10px] mt-1 tabular-nums ${isOver ? 'text-amber-400' : 'text-nourish-border'}`}>
                        {Math.round(pctRaw)}% do objectivo ({Math.round(g.expected)} {g.unit})
                      </p>
                    </div>
                  )
                })}
              </div>

              {avgPerDay && totals.mealsLogged > 0 && (
                <p className="text-xs text-nourish-text-dim text-center">
                  Média ~{avgPerDay.calories} kcal e {avgPerDay.protein} g proteína por dia no período
                </p>
              )}
            </section>
        )}

        {!loading && !error && tab === 'objectivos' && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-nourish-primary uppercase tracking-wider">
                Objectivos
              </h2>

              <div className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-nourish-text mb-1">
                    Recomendados para ti
                  </p>
                  <p className="text-xs text-nourish-text-dim leading-snug">{profileSummary(profile, recommended)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-nourish-surface-high rounded-lg py-2">
                    <p className="text-nourish-text-dim">kcal/dia</p>
                    <p className="font-bold text-nourish-text tabular-nums">{recommended.caloriesPerDay}</p>
                  </div>
                  <div className="bg-nourish-surface-high rounded-lg py-2">
                    <p className="text-nourish-text-dim">Proteína</p>
                    <p className="font-bold text-nourish-text tabular-nums">{recommended.proteinPerDay} g</p>
                  </div>
                  <div className="bg-nourish-surface-high rounded-lg py-2">
                    <p className="text-nourish-text-dim">Hidratos</p>
                    <p className="font-bold text-nourish-text tabular-nums">{recommended.carbsPerDay} g</p>
                  </div>
                  <div className="bg-nourish-surface-high rounded-lg py-2">
                    <p className="text-nourish-text-dim">Gordura</p>
                    <p className="font-bold text-nourish-text tabular-nums">{recommended.fatPerDay} g</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTargets(recommended)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-nourish-primary text-nourish-on-primary active:opacity-90 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                >
                  Usar estes objectivos
                </button>
                <button
                  type="button"
                  onClick={() => setShowBody((v) => !v)}
                  className="w-full text-xs text-nourish-text-dim underline focus:outline-none"
                >
                  {showBody ? 'Ocultar dados pessoais' : 'Idade, peso e meta'}
                </button>
                {showBody && (
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-nourish-border">
                    <label className="text-xs text-nourish-text-dim col-span-1">
                      Idade
                      <NumericInput
                        integer
                        min={14}
                        max={99}
                        fallback={DEFAULT_USER_PROFILE.age}
                        className={`${inputClass} mt-1`}
                        value={profile.age}
                        onChange={(n) => updateField('age', n)}
                      />
                    </label>
                    <label className="text-xs text-nourish-text-dim col-span-1">
                      Sexo
                      <select
                        className={`${inputClass} mt-1`}
                        value={profile.sex}
                        onChange={(e) => updateField('sex', e.target.value as 'male' | 'female')}
                      >
                        <option value="male">Masculino</option>
                        <option value="female">Feminino</option>
                      </select>
                    </label>
                    <label className="text-xs text-nourish-text-dim">
                      Peso (kg)
                      <NumericInput
                        integer
                        min={1}
                        fallback={DEFAULT_USER_PROFILE.weightKg}
                        className={`${inputClass} mt-1`}
                        value={profile.weightKg}
                        onChange={(n) => updateField('weightKg', n)}
                      />
                    </label>
                    <label className="text-xs text-nourish-text-dim">
                      Altura (cm)
                      <NumericInput
                        integer
                        min={1}
                        fallback={DEFAULT_USER_PROFILE.heightCm}
                        className={`${inputClass} mt-1`}
                        value={profile.heightCm}
                        onChange={(n) => updateField('heightCm', n)}
                      />
                    </label>
                    <label className="text-xs text-nourish-text-dim col-span-2">
                      Actividade
                      <select
                        className={`${inputClass} mt-1`}
                        value={profile.activity}
                        onChange={(e) => updateField('activity', e.target.value as typeof profile.activity)}
                      >
                        {(Object.keys(ACTIVITY_LABELS) as (keyof typeof ACTIVITY_LABELS)[]).map((k) => (
                          <option key={k} value={k}>{ACTIVITY_LABELS[k]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-nourish-text-dim col-span-2">
                      Meta
                      <select
                        className={`${inputClass} mt-1`}
                        value={profile.goal}
                        onChange={(e) => updateField('goal', e.target.value as typeof profile.goal)}
                      >
                        {(Object.keys(GOAL_LABELS) as (keyof typeof GOAL_LABELS)[]).map((k) => (
                          <option key={k} value={k}>{GOAL_LABELS[k]}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowTargets((v) => !v)}
                className="w-full text-sm text-nourish-text-dim underline focus:outline-none"
              >
                {showTargets ? 'Ocultar objectivos manuais' : 'Ajustar objectivos manualmente'}
              </button>

              {showTargets && (
                <div className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-nourish-text-dim">
                      kcal/dia
                      <NumericInput
                        integer
                        min={0}
                        fallback={DEFAULT_TARGETS.caloriesPerDay}
                        className={`${inputClass} mt-1`}
                        value={targets.caloriesPerDay}
                        onChange={(n) => setTargets({ ...targets, caloriesPerDay: n })}
                      />
                    </label>
                    <label className="text-xs text-nourish-text-dim">
                      Proteína g/dia
                      <NumericInput
                        integer
                        min={0}
                        fallback={DEFAULT_TARGETS.proteinPerDay}
                        className={`${inputClass} mt-1`}
                        value={targets.proteinPerDay}
                        onChange={(n) => setTargets({ ...targets, proteinPerDay: n })}
                      />
                    </label>
                    <label className="text-xs text-nourish-text-dim">
                      Hidratos g/dia
                      <NumericInput
                        integer
                        min={0}
                        fallback={DEFAULT_TARGETS.carbsPerDay}
                        className={`${inputClass} mt-1`}
                        value={targets.carbsPerDay}
                        onChange={(n) => setTargets({ ...targets, carbsPerDay: n })}
                      />
                    </label>
                    <label className="text-xs text-nourish-text-dim">
                      Gordura g/dia
                      <NumericInput
                        integer
                        min={0}
                        fallback={DEFAULT_TARGETS.fatPerDay}
                        className={`${inputClass} mt-1`}
                        value={targets.fatPerDay}
                        onChange={(n) => setTargets({ ...targets, fatPerDay: n })}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={resetTargets}
                    className="text-xs text-nourish-text-dim underline focus:outline-none"
                  >
                    Repor predefinições ({DEFAULT_TARGETS.caloriesPerDay} kcal…)
                  </button>
                </div>
              )}
            </section>
        )}

        {!loading && !error && tab === 'viaturas' && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-nourish-primary uppercase tracking-wider">
                Viaturas
              </h2>
              <div className="rounded-2xl border border-nourish-border bg-nourish-surface p-4 space-y-3">
                <p className="text-xs text-nourish-text-dim leading-snug">
                  Km ida/volta calculados automaticamente (estradas via OSRM, ou coordenadas das zonas HA). Preço do combustível vem da DGEG. Consumo em L/100 km — GPL nos bicombustíveis.
                </p>
                {fuelPrices && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-nourish-bg border border-nourish-border py-2">
                        <p className="text-nourish-text-dim">Gasóleo</p>
                        <p className="font-bold text-nourish-primary tabular-nums">
                          €{fuelPrices.diesel_eur_per_l.toFixed(3)}/L
                        </p>
                      </div>
                      <div className="rounded-lg bg-nourish-bg border border-nourish-border py-2">
                        <p className="text-nourish-text-dim">Gasolina 95</p>
                        <p className="font-bold text-nourish-primary tabular-nums">
                          €{fuelPrices.gasoline_eur_per_l.toFixed(3)}/L
                        </p>
                      </div>
                      <div className="rounded-lg bg-nourish-bg border border-nourish-border py-2">
                        <p className="text-nourish-text-dim">GPL</p>
                        <p className="font-bold text-nourish-primary tabular-nums">
                          €{fuelPrices.gpl_eur_per_l.toFixed(3)}/L
                        </p>
                      </div>
                    </div>
                    {fuelPricesUpdatedLabel && (
                      <p className="text-[11px] text-nourish-text-dim text-center leading-snug">
                        Actualizado a {fuelPricesUpdatedLabel}
                        {fuelPrices.source !== 'dgeg' ? ' · estimativa local' : ''}
                      </p>
                    )}
                  </div>
                )}
                {cars.length === 0 && !showCarForm && (
                  <p className="text-sm text-nourish-text-dim text-center py-2">Sem viaturas registadas</p>
                )}
                {cars.map((car) => (
                  <div key={car.id} className="rounded-xl border border-nourish-border bg-nourish-bg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-nourish-text">{car.name}</p>
                      <button
                        type="button"
                        onClick={() => removeCar(car.id)}
                        className="text-xs text-red-400 focus:outline-none"
                      >
                        Remover
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-nourish-text-dim">
                        L/100 km
                        <NumericInput
                          min={0}
                          step={0.1}
                          fallback={6}
                          className={`${inputClass} mt-0.5 text-xs py-1.5`}
                          value={car.consumption_l100km}
                          onChange={(n) => updateCar(car.id, { consumption_l100km: n })}
                        />
                      </label>
                      <label className="text-[10px] text-nourish-text-dim">
                        Combustível
                        <select
                          className={`${inputClass} mt-0.5 text-xs py-1.5`}
                          value={car.fuel_type ?? 'diesel'}
                          onChange={(e) =>
                            updateCar(car.id, { fuel_type: e.target.value as FuelType })
                          }
                        >
                          {FUEL_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
                {showCarForm ? (
                  <div className="rounded-xl border border-nourish-primary/40 bg-nourish-bg p-3 space-y-2">
                    <CarModelInput
                      value={carDraft.name}
                      onChange={(name) => setCarDraft((d) => ({ ...d, name }))}
                      onSelectPreset={(preset) =>
                        setCarDraft((d) => ({
                          ...d,
                          name: preset.label,
                          consumption_l100km:
                            preset.consumption_l100km > 0 ? preset.consumption_l100km : d.consumption_l100km,
                          fuel_type: preset.fuel_type ?? d.fuel_type,
                        }))
                      }
                      className={inputClass}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-nourish-text-dim">
                        L/100 km
                        <NumericInput
                          min={0}
                          step={0.1}
                          fallback={6}
                          className={`${inputClass} mt-0.5 text-xs py-1.5`}
                          value={carDraft.consumption_l100km}
                          onChange={(n) => setCarDraft((d) => ({ ...d, consumption_l100km: n }))}
                        />
                      </label>
                      <label className="text-[10px] text-nourish-text-dim">
                        Combustível
                        <select
                          className={`${inputClass} mt-0.5 text-xs py-1.5`}
                          value={carDraft.fuel_type ?? 'diesel'}
                          onChange={(e) =>
                            setCarDraft((d) => ({
                              ...d,
                              fuel_type: e.target.value as FuelType,
                            }))
                          }
                        >
                          {FUEL_TYPE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCarForm(false)}
                        className="flex-1 py-2 text-sm text-nourish-text-dim"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCar}
                        className="flex-1 py-2 rounded-xl bg-nourish-primary text-nourish-on-primary text-sm font-semibold"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCarForm(true)}
                    className="w-full py-2.5 rounded-xl border border-dashed border-nourish-border text-sm text-nourish-primary font-medium"
                  >
                    + Adicionar viatura
                  </button>
                )}
              </div>
            </section>
        )}

        {!loading && !error && tab === 'definicoes' && (
          <>
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-nourish-primary uppercase tracking-wider">
                Aparência
              </h2>
              <div className="rounded-2xl border border-nourish-border bg-nourish-surface p-4 space-y-4">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-nourish-text">Mostrar porções nas refeições</p>
                    <p className="text-xs text-nourish-text-dim mt-0.5">
                      O número no canto dos cartões no separador Refeições
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.showMealPortions}
                    onChange={(e) => updatePref('showMealPortions', e.target.checked)}
                    className="rounded border-nourish-border w-5 h-5"
                  />
                </label>
                <div>
                  <p className="text-sm font-medium text-nourish-text mb-1.5">Ecrã inicial</p>
                  <p className="text-xs text-nourish-text-dim mb-2">
                    Separador aberto ao iniciar a app
                  </p>
                  <div
                    className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-nourish-bg border border-nourish-border"
                    role="tablist"
                    aria-label="Ecrã inicial"
                  >
                    {([
                      { key: 'plan' as const, label: 'Planear' },
                      { key: 'meals' as const, label: 'Refeições' },
                    ]).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={prefs.defaultTab === key}
                        onClick={() => updatePref('defaultTab', key)}
                        className={`py-2 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                          prefs.defaultTab === key
                            ? 'bg-nourish-primary text-nourish-on-primary'
                            : 'text-nourish-text-dim'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-nourish-primary uppercase tracking-wider">
                Casa e supermercado
              </h2>
              <div className="rounded-2xl border border-nourish-border bg-nourish-surface p-4">
                <div className="text-center mb-4 py-2 rounded-xl bg-nourish-bg border border-nourish-border">
                  <p className="text-3xl font-bold text-nourish-primary tabular-nums">
                    {hasShopIntervalMedian(homelabMetrics)
                      ? homelabMetrics!.avg_days_between_shops
                      : homelabMetrics
                        ? shopIntervalDays(homelabMetrics)
                        : defaultDaysUntilShop()}
                  </p>
                  <p className="text-xs text-nourish-text-dim mt-1">
                    {hasShopIntervalMedian(homelabMetrics)
                      ? 'dias entre compras (mediana do historial)'
                      : 'dias até à próxima ida ao super (estimativa)'}
                  </p>
                </div>
                {homelabMetricsError && (
                  <p className="text-xs text-amber-600/90 mb-3 text-center">
                    Visitas e intervalos não carregaram — verifica ligação a /nourish/metrics
                  </p>
                )}
                {homelabMetrics && (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div>
                        <p className="text-xl font-bold text-nourish-text tabular-nums">
                          {homelabMetrics.supermarket_visits_week}
                        </p>
                        <p className="text-[10px] text-nourish-text-dim">visitas ao super / semana</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-nourish-text tabular-nums">
                          {homelabMetrics.leave_home_week}
                        </p>
                        <p className="text-[10px] text-nourish-text-dim">saídas de casa / semana</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-nourish-text tabular-nums">
                          {homelabMetrics.supermarket_visits_month}
                        </p>
                        <p className="text-[10px] text-nourish-text-dim">visitas / mês</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-nourish-text tabular-nums">
                          {homelabMetrics.avg_days_between_shops ?? '—'}
                        </p>
                        <p className="text-[10px] text-nourish-text-dim">dias entre compras (mediana)</p>
                      </div>
                    </div>
                    <p className="text-xs text-nourish-text-dim mt-3 text-center">
                      Lista automática ao sair: ~{shopIntervalDays(homelabMetrics)} dias de despensa
                      {hasShopIntervalMedian(homelabMetrics) ? ' (mediana)' : ''}
                    </p>
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-nourish-border bg-nourish-surface p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-nourish-text">Supermercados</p>
                  <p className="text-xs text-nourish-text-dim mt-0.5 leading-snug">
                    Após ~3 min num super novo, recebes notificação no telemóvel. Acompanhar cria uma zona HA
                    (~130 m) e regista visitas; ignorar não volta a perguntar.
                  </p>
                </div>
                {supermarkets ? (
                  <>
                    <div>
                      <p className="text-[10px] font-semibold text-nourish-primary uppercase tracking-wider mb-1.5">
                        A acompanhar
                      </p>
                      {supermarkets.tracked.length === 0 ? (
                        <p className="text-xs text-nourish-text-dim">Nenhum registado</p>
                      ) : (
                        <ul className="space-y-1">
                          {supermarkets.tracked.map((s) => (
                            <li
                              key={s.place_key}
                              className="flex items-center justify-between gap-2 text-sm text-nourish-text"
                            >
                              <span className="truncate">{s.name}</span>
                              {s.place_key !== 'auchan' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (await removeTracked(s.place_key)) refreshSupermarkets()
                                  }}
                                  className="text-xs text-nourish-text-dim shrink-0 focus:outline-none"
                                >
                                  Remover
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-nourish-text-dim uppercase tracking-wider mb-1.5">
                        Ignorados
                      </p>
                      {supermarkets.blocklist.length === 0 ? (
                        <p className="text-xs text-nourish-text-dim">Nenhum</p>
                      ) : (
                        <ul className="space-y-1">
                          {supermarkets.blocklist.map((b) => (
                            <li
                              key={b.place_key}
                              className="flex items-center justify-between gap-2 text-sm text-nourish-text-dim"
                            >
                              <span className="truncate">{b.name}</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (await unblockPlace(b.place_key)) refreshSupermarkets()
                                }}
                                className="text-xs text-nourish-primary shrink-0 focus:outline-none"
                              >
                                Reativar
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-nourish-text-dim">A carregar lista…</p>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-nourish-primary uppercase tracking-wider">
                App
              </h2>
              <div className="rounded-2xl border border-nourish-border bg-nourish-surface p-4 space-y-3">
                <p className="text-xs text-nourish-text-dim">
                  Se vires &quot;Failed to fetch&quot; no telemóvel, tenta reparar a app em vez de a reinstalar.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void nudgeServiceWorkerUpdate()}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-nourish-border text-nourish-text hover:bg-nourish-border/10 transition-colors focus:outline-none"
                  >
                    Verificar atualização
                  </button>
                  <button
                    type="button"
                    onClick={() => void clearPwaCachesAndReload()}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-nourish-primary text-nourish-on-primary hover:opacity-90 transition-opacity focus:outline-none"
                  >
                    Reparar app
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {showFuelTripsSheet && (
        <VisitFuelTripsSheet
          trips={fuelTrips}
          periodLabel={resumoPeriodLabel}
          totalFuelEur={visitSpend.fuelEur}
          onClose={() => setShowFuelTripsSheet(false)}
        />
      )}

      {showShoppingTripsSheet && (
        <VisitShoppingTripsSheet
          trips={shoppingTrips}
          periodLabel={resumoPeriodLabel}
          totalShoppingEur={visitSpend.shoppingEur}
          onClose={() => setShowShoppingTripsSheet(false)}
        />
      )}

      {showMealSpendSheet && (
        <MealSpendSheet
          meals={mealSpendRows}
          periodLabel={resumoPeriodLabel}
          totalSpendEur={totals.spend}
          onClose={() => setShowMealSpendSheet(false)}
        />
      )}

      <BottomNav />
    </div>
  )
}
