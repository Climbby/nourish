import { useEffect, useLayoutEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { rememberNavPath } from '../utils/navMemory'
import { grocy } from '../api/grocy'
import type { MealPlanEntry, Recipe } from '../types/grocy'
import { BottomNav } from '../components/BottomNav'
import { BottomSheet } from '../components/BottomSheet'
import { ConnectionError } from '../components/ConnectionError'
import { CarModelInput } from '../components/CarModelInput'
import { HelpInfo } from '../components/HelpInfo'
import { IosToggle } from '../components/IosToggle'
import { VisitFuelTripsSheet } from '../components/VisitFuelTripsSheet'
import { VisitShoppingTripsSheet } from '../components/VisitShoppingTripsSheet'
import { NumericInput } from '../components/NumericInput'
import { Spinner } from '../components/Spinner'
import { ProfilePicker } from '../components/ProfilePicker'
import { SupermarketSearchAdd } from '../components/SupermarketSearchAdd'
import { useHouseholdProfiles } from '../hooks/useHouseholdProfiles'
import { useDisplayPrefs } from '../hooks/useDisplayPrefs'
import { useCars, type Car } from '../hooks/useCars'
import { useFuelPrices } from '../hooks/useFuelPrices'
import { useNutritionTargets, DEFAULT_TARGETS } from '../hooks/useNutritionTargets'
import { useShowNutrition } from '../hooks/useShowNutrition'
import type { FuelKind, FuelType } from '../utils/fuelPrices'
import { FUEL_TYPE_OPTIONS, formatFuelPricesUpdatedAt, reportFuelPriceIssue } from '../utils/fuelPrices'
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
  HEALTH_CONDITIONS,
  HEALTH_CONDITION_LABELS,
  dietaryFlags,
  profileAge,
  profileSummary,
  recommendedDailyTargets,
  type UserBodyProfile,
} from '../utils/nutritionRecommendations'
import {
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
import { filterIgnoredVisits } from '../utils/ignoredSupermarket'
import { supermarketLabelForVisit } from '../utils/visitSupermarketLabel'
import { mealLogCountsTowardStats } from '../utils/mealLogAttribution'
import {
  parseProfileTab,
  profilePathForTab,
  resumoHasContent,
  visibleProfileTabs,
  type ProfileTab,
} from '../utils/profileTabs'
import {
  fetchVisitAttributions,
  visitAttributionMap,
  visitCountsTowardSpend,
  type VisitAttribution,
} from '../utils/visitAttributions'

const PERIODS: { key: StatsPeriod; short: string }[] = [
  { key: '7d', short: '7 dias' },
  { key: '30d', short: '30 dias' },
  { key: 'month', short: 'Mês' },
]

function FuelMissingReport({
  fuel,
  label,
  onReported,
}: {
  fuel: FuelKind
  label?: string
  onReported?: () => void
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const fuelLabel =
    fuel === 'diesel' ? 'gasóleo' : fuel === 'gasoline' ? 'gasolina 95' : 'GPL'

  async function handleReport() {
    setStatus('sending')
    const ok = await reportFuelPriceIssue(fuel, `Preço ${fuelLabel} em falta na app`)
    setStatus(ok ? 'sent' : 'error')
    if (ok) onReported?.()
  }

  if (status === 'sent') {
    return (
      <p className="text-[11px] text-nourish-primary text-center leading-snug">
        Problema reportado ({fuelLabel}). Obrigado.
      </p>
    )
  }

  return (
    <button
      type="button"
      disabled={status === 'sending'}
      onClick={() => void handleReport()}
      className="w-full py-2 rounded-xl text-xs font-semibold border border-amber-700/50 text-amber-200/90 active:bg-amber-900/30 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
    >
      {status === 'sending'
        ? 'A enviar…'
        : status === 'error'
          ? 'Falhou — tentar de novo'
          : label ?? `Reportar: ${fuelLabel} em falta`}
    </button>
  )
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { key: T; label: string }[]
  value: T
  onChange: (next: T) => void
  ariaLabel: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  /** Skip CSS transition until after the first measured layout (avoids mount slide). */
  const hasMeasuredRef = useRef(false)
  const [pill, setPill] = useState({ left: 2, width: 0, animate: false })

  const measurePill = useCallback(
    (animate: boolean) => {
      const container = containerRef.current
      const index = options.findIndex((o) => o.key === value)
      const btn = btnRefs.current[index < 0 ? 0 : index]
      if (!container || !btn) return false
      setPill({
        left: btn.offsetLeft,
        width: btn.offsetWidth,
        animate,
      })
      return true
    },
    [options, value]
  )

  useLayoutEffect(() => {
    // First successful layout: snap. Later value changes: animate.
    const animate = hasMeasuredRef.current
    if (measurePill(animate)) hasMeasuredRef.current = true
  }, [measurePill])

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measurePill(false))
    ro.observe(container)
    return () => ro.disconnect()
  }, [measurePill])

  return (
    <div
      ref={containerRef}
      className="relative grid grid-cols-2 p-0.5 rounded-lg bg-nourish-bg border border-nourish-border flex-shrink-0"
      role="tablist"
      aria-label={ariaLabel}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute top-0.5 bottom-0.5 rounded-md bg-nourish-primary shadow-sm ${
          pill.animate ? 'transition-[left,width] duration-200 ease-out' : ''
        }`}
        style={{
          left: pill.left,
          width: pill.width || undefined,
          opacity: pill.width > 0 ? 1 : 0,
        }}
      />
      {options.map(({ key, label }, i) => {
        const selected = value === key
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            ref={(el) => {
              btnRefs.current[i] = el
            }}
            onClick={() => {
              if (selected) {
                const next = options[(i + 1) % options.length]
                if (next) onChange(next.key)
                return
              }
              onChange(key)
            }}
            className={`relative z-10 min-w-0 px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
              selected ? 'text-nourish-on-primary' : 'text-nourish-text-dim'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function MapPinIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  )
}

function TrashIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}

function mapsUrl(opts: { latitude?: number; longitude?: number; name: string }): string {
  const { latitude: lat, longitude: lng, name } = opts
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`
}

const iconBtnClass =
  'inline-flex items-center justify-center w-8 h-8 rounded-lg text-nourish-text-dim active:bg-nourish-surface-high focus:outline-none focus:ring-2 focus:ring-nourish-primary'

const inputClass =
  'w-full px-3 py-2 bg-nourish-surface border border-nourish-border rounded-xl text-nourish-text text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary'

const spendCardClass =
  'text-left bg-nourish-surface border border-nourish-border rounded-2xl p-4 transition-colors hover:border-nourish-primary/40 focus:outline-none focus:ring-2 focus:ring-nourish-primary disabled:opacity-60'

export function Profile() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { targets, setTargets, enabled: targetsEnabled, setEnabled: setTargetsEnabled } =
    useNutritionTargets()
  const {
    profile,
    updateField,
    enabled: profileEnabled,
    setEnabled: setProfileEnabled,
  } = useUserProfile()
  const { prefs, updatePref } = useDisplayPrefs()
  const showPrices = !prefs.hidePrices
  const { activeProfile, activeId } = useHouseholdProfiles()
  const [profilePickerOpen, setProfilePickerOpen] = useState(false)
  const { cars, addCar, updateCar, removeCar, refreshCars, enabled: carsEnabled, setEnabled: setCarsEnabled } =
    useCars()
  const { prices: fuelPrices, refresh: refreshFuel } = useFuelPrices()
  const tab = parseProfileTab(searchParams.get('tab'))

  // Legacy deep-links used location.state.tab — fold into the URL once
  useEffect(() => {
    const stateTab = (location.state as { tab?: string } | null)?.tab
    if (!stateTab || searchParams.get('tab')) return
    const parsed = parseProfileTab(stateTab)
    if (parsed === 'definicoes') return
    setSearchParams({ tab: parsed }, { replace: true })
  }, [location.state, searchParams, setSearchParams])

  const setTab = useCallback(
    (next: ProfileTab) => {
      const params = new URLSearchParams(searchParams)
      if (next === 'definicoes') params.delete('tab')
      else params.set('tab', next)
      setSearchParams(params, { replace: true })
      rememberNavPath('profile', profilePathForTab(next))
    },
    [searchParams, setSearchParams]
  )

  // Tab switches keep window scroll; reset so the header/title isn't clipped.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  const [period, setPeriod] = useState<StatsPeriod>('7d')
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTargets, setShowTargets] = useState(false)
  const [bodyOpen, setBodyOpen] = useState(false)
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [carsOpen, setCarsOpen] = useState(false)
  const [homelabMetrics, setHomelabMetrics] = useState<HomelabMetrics | null>(null)
  const [homelabMetricsError, setHomelabMetricsError] = useState(false)
  const [supermarkets, setSupermarkets] = useState<SupermarketsData | null>(null)
  const [supermarketVisits, setSupermarketVisits] = useState<SupermarketVisit[]>([])
  const [visitCars, setVisitCars] = useState<VisitCarLink[]>([])
  const [visitReceipts, setVisitReceipts] = useState<VisitReceiptLink[]>([])
  const [visitAttrs, setVisitAttrs] = useState<VisitAttribution[]>([])
  const [visitSpendLoading, setVisitSpendLoading] = useState(true)
  const [showFuelTripsSheet, setShowFuelTripsSheet] = useState(false)
  const [showShoppingTripsSheet, setShowShoppingTripsSheet] = useState(false)

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
      fetchVisitAttributions(),
    ])
      .then(([visits, carLinks, receipts, attributions]) => {
        setSupermarketVisits(visits ?? [])
        setVisitCars(carLinks)
        setVisitReceipts(receipts)
        setVisitAttrs(attributions)
      })
      .finally(() => setVisitSpendLoading(false))
  }, [refreshCars, refreshFuel, refreshSupermarkets])

  useEffect(() => {
    if (tab === 'definicoes') refreshSupermarkets()
  }, [tab, refreshSupermarkets])

  const recommended = useMemo(() => recommendedDailyTargets(profile), [profile])
  const ageYears = useMemo(() => profileAge(profile), [profile])
  const nutritionActive = useShowNutrition()
  const todayIso = useMemo(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
  }, [])
  const fuelPricesUpdatedLabel = fuelPrices
    ? formatFuelPricesUpdatedAt(fuelPrices.updated_at)
    : null

  function updateBodyField<K extends keyof UserBodyProfile>(key: K, value: UserBodyProfile[K]) {
    const next = { ...profile, [key]: value }
    updateField(key, value)
    setTargets(recommendedDailyTargets(next))
  }

  function toggleProfileEnabled(next: boolean) {
    setProfileEnabled(next)
    if (next) {
      setTargetsEnabled(true)
      setTargets(recommendedDailyTargets(profile))
      setBodyOpen(true)
      setGoalsOpen(true)
    }
  }

  function toggleTargetsEnabled(next: boolean) {
    setTargetsEnabled(next)
    if (next) {
      setGoalsOpen(true)
      setShowTargets(true)
    }
  }

  function toggleCarsEnabled(next: boolean) {
    setCarsEnabled(next)
    if (next) setCarsOpen(true)
  }

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
  const profileMealPlan = useMemo(
    () => mealPlan.filter((e) => mealLogCountsTowardStats(e.note, activeId)),
    [mealPlan, activeId]
  )
  const periodEntries = useMemo(
    () => filterMealPlanByPeriod(profileMealPlan, period),
    [profileMealPlan, period]
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

  const knownSupermarkets = useMemo(() => {
    if (!supermarkets) return []
    return [
      ...supermarkets.tracked.map((s) => ({
        place_key: s.place_key,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
      })),
      ...supermarkets.blocklist.map((b) => ({
        place_key: b.place_key,
        name: b.name,
      })),
    ]
  }, [supermarkets])

  const carsById = useMemo(
    () => (carsEnabled ? new Map(cars.map((c) => [c.id, c])) : new Map()),
    [cars, carsEnabled]
  )
  const attrByVisit = useMemo(() => visitAttributionMap(visitAttrs), [visitAttrs])
  const visitsInPeriod = useMemo(() => {
    const inPeriod = filterVisitsByPeriod(supermarketVisits, period)
    const attributed = inPeriod.filter((v) =>
      visitCountsTowardSpend(v.entered_at, activeId, attrByVisit)
    )
    return filterIgnoredVisits(attributed, supermarkets?.blocklist ?? [], (v) =>
      supermarketLabelForVisit(v, supermarkets?.tracked ?? [])
    )
  }, [supermarketVisits, period, activeId, attrByVisit, supermarkets])
  const visitSpend = useMemo(() => {
    return aggregateVisitSpend(visitsInPeriod, visitCars, visitReceipts, carsById)
  }, [visitsInPeriod, visitCars, visitReceipts, carsById])
  const lookbackEntries = useMemo(
    () => filterMealPlanByPeriod(profileMealPlan, '30d'),
    [profileMealPlan]
  )
  const lookbackMealsLogged = useMemo(
    () => aggregateMealStats(lookbackEntries, recipesById).mealsLogged,
    [lookbackEntries, recipesById]
  )
  const visitsLookback = useMemo(() => {
    const inPeriod = filterVisitsByPeriod(supermarketVisits, '30d')
    const attributed = inPeriod.filter((v) =>
      visitCountsTowardSpend(v.entered_at, activeId, attrByVisit)
    )
    return filterIgnoredVisits(attributed, supermarkets?.blocklist ?? [], (v) =>
      supermarketLabelForVisit(v, supermarkets?.tracked ?? [])
    )
  }, [supermarketVisits, activeId, attrByVisit, supermarkets])
  const spendLookback = useMemo(
    () => aggregateVisitSpend(visitsLookback, visitCars, visitReceipts, carsById),
    [visitsLookback, visitCars, visitReceipts, carsById]
  )
  const resumoReady = !loading && !visitSpendLoading
  const hasResumo = resumoHasContent({
    nutritionActive,
    mealsLogged: lookbackMealsLogged,
    showPrices,
    shoppingEur: spendLookback.shoppingEur,
    fuelEur: spendLookback.fuelEur,
    visitCount: spendLookback.visitsInPeriod,
  })
  const showResumoTab = hasResumo || (!resumoReady && tab === 'resumo')
  const profileTabs = visibleProfileTabs(showResumoTab)

  useEffect(() => {
    if (tab === 'resumo' && resumoReady && !hasResumo) return
    rememberNavPath('profile', profilePathForTab(tab))
  }, [tab, resumoReady, hasResumo])

  useEffect(() => {
    if (!resumoReady || hasResumo || tab !== 'resumo') return
    setTab('definicoes')
  }, [resumoReady, hasResumo, tab, setTab])

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

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header
        className="sticky top-0 z-20 px-4 pb-3 border-b border-nourish-border bg-nourish-bg"
        style={{
          paddingTop: 'max(3rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-nourish-text">Perfil</h1>
          <button
            type="button"
            onClick={() => setProfilePickerOpen(true)}
            className="flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-offset-2 focus:ring-offset-nourish-bg"
            aria-label={
              activeProfile
                ? `Trocar perfil (activo: ${activeProfile.name})`
                : 'Escolher perfil'
            }
            title={activeProfile?.name ?? 'Escolher perfil'}
          >
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-nourish-bg border-2 border-nourish-border"
              style={{
                backgroundColor: activeProfile?.color ?? '#6b7280',
              }}
              aria-hidden
            >
              {activeProfile?.name.trim().charAt(0).toUpperCase() || '?'}
            </span>
          </button>
        </div>
        <div
          className="flex gap-2 mt-4 overflow-x-auto pb-0.5"
          style={{ scrollbarWidth: 'none' }}
          role="tablist"
          aria-label="Secções do perfil"
        >
          {profileTabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onMouseDown={(e) => e.preventDefault()}
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

      <BottomSheet
        open={profilePickerOpen}
        onClose={() => setProfilePickerOpen(false)}
        ariaLabel="Trocar perfil"
      >
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-bold text-nourish-text">Trocar perfil</h2>
            <button
              type="button"
              onClick={() => setProfilePickerOpen(false)}
              className="p-1.5 -mr-1 text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded-lg"
              aria-label="Fechar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ProfilePicker embedded onPicked={() => setProfilePickerOpen(false)} />
        </div>
      </BottomSheet>

      <main className="p-4 space-y-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}>
        {tab === 'resumo' && showResumoTab && (
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

        {/* Reparar stays reachable on Casa even when profile load failed */}
        {error && !loading && tab === 'definicoes' && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-nourish-primary uppercase tracking-wider">
              App
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void nudgeServiceWorkerUpdate()}
                className="w-full py-2.5 rounded-xl text-xs font-semibold border border-nourish-border text-nourish-text active:bg-nourish-surface-high focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              >
                Verificar atualização
              </button>
              <button
                type="button"
                onClick={() => void clearPwaCachesAndReload()}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-nourish-primary text-nourish-on-primary active:opacity-90 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              >
                Reparar app
              </button>
            </div>
          </section>
        )}

        {!loading && !error && tab === 'resumo' && hasResumo && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-nourish-primary tracking-wide">
                Resumo · {resumoPeriodLabel}
              </h2>

              {showPrices && (
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
                  </button>
                </div>
              )}

              {nutritionActive && surpluses.length > 0 && totals.mealsLogged > 0 && (
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

              {nutritionActive && (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {gaps.map((g) => {
                      const pctRaw = g.expected > 0 ? (g.actual / g.expected) * 100 : 0
                      const isOver = surplusKeys.has(g.key)
                      const barPct = Math.min(100, Math.round(pctRaw))
                      return (
                        <div key={g.key}>
                          <p className="text-xs text-nourish-text-dim">{g.label}</p>
                          <div className="mt-1.5 h-1.5 bg-nourish-surface-high rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isOver ? 'bg-amber-500' : 'bg-nourish-primary'
                              }`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {avgPerDay && totals.mealsLogged > 0 && (
                    <p className="text-xs text-nourish-text-dim text-center">
                      Média ~{avgPerDay.calories} kcal e {avgPerDay.protein} g proteína por dia no período
                    </p>
                  )}
                </>
              )}
            </section>
        )}

        {!loading && !error && tab === 'objectivos' && (
          <>
            <section className="space-y-3">
              <div className="bg-nourish-surface border border-nourish-border rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setBodyOpen((v) => !v)}
                    className="flex-1 min-w-0 text-left focus:outline-none"
                    aria-expanded={bodyOpen}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-nourish-text">Dados pessoais</p>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide ${
                          profileEnabled ? 'text-nourish-primary' : 'text-nourish-text-dim'
                        }`}
                      >
                        {profileEnabled ? 'Activo' : 'Desactivado'}
                      </span>
                    </div>
                    <p className="text-xs text-nourish-text-dim leading-snug mt-0.5">
                      Opcional · melhora recomendações no Planear e no Resumo
                    </p>
                  </button>
                  <IosToggle
                    checked={profileEnabled}
                    onChange={toggleProfileEnabled}
                    label="Activar dados pessoais"
                  />
                </div>
                {bodyOpen && profileEnabled && (
                  <div className="border-t border-nourish-border p-4 space-y-3 animate-soft-fade">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-nourish-text-dim col-span-1">
                        Data de nascimento
                        <input
                          type="date"
                          className={`${inputClass} mt-1`}
                          value={profile.birthDate}
                          max={todayIso}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v) updateBodyField('birthDate', v)
                          }}
                        />
                        <span className="mt-1 block text-[11px] text-nourish-text-dim tabular-nums">
                          {ageYears} anos
                        </span>
                      </label>
                      <label className="text-xs text-nourish-text-dim col-span-1">
                        Sexo
                        <select
                          className={`${inputClass} mt-1`}
                          value={profile.sex}
                          onChange={(e) => updateBodyField('sex', e.target.value as 'male' | 'female')}
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
                          onChange={(n) => updateBodyField('weightKg', n)}
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
                          onChange={(n) => updateBodyField('heightCm', n)}
                        />
                      </label>
                      <label className="text-xs text-nourish-text-dim col-span-2">
                        Actividade
                        <select
                          className={`${inputClass} mt-1`}
                          value={profile.activity}
                          onChange={(e) =>
                            updateBodyField('activity', e.target.value as typeof profile.activity)
                          }
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
                          onChange={(e) =>
                            updateBodyField('goal', e.target.value as typeof profile.goal)
                          }
                        >
                          {(Object.keys(GOAL_LABELS) as (keyof typeof GOAL_LABELS)[]).map((k) => (
                            <option key={k} value={k}>{GOAL_LABELS[k]}</option>
                          ))}
                        </select>
                      </label>

                      <fieldset className="col-span-2">
                        <legend className="text-xs text-nourish-text-dim mb-1.5">
                          Condições de saúde
                        </legend>
                        <div className="flex flex-wrap gap-2">
                          {HEALTH_CONDITIONS.map((c) => {
                            const active = profile.conditions.includes(c)
                            return (
                              <button
                                key={c}
                                type="button"
                                aria-pressed={active}
                                onClick={() =>
                                  updateBodyField(
                                    'conditions',
                                    active
                                      ? profile.conditions.filter((x) => x !== c)
                                      : [...profile.conditions, c]
                                  )
                                }
                                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                                  active
                                    ? 'bg-nourish-primary text-nourish-on-primary border-nourish-primary'
                                    : 'bg-nourish-surface text-nourish-text-dim border-nourish-border'
                                }`}
                              >
                                {HEALTH_CONDITION_LABELS[c]}
                              </button>
                            )
                          })}
                        </div>
                      </fieldset>

                      <label className="text-xs text-nourish-text-dim col-span-2">
                        Alergias e o que não come
                        <textarea
                          className={`${inputClass} mt-1 resize-none`}
                          rows={2}
                          value={profile.dislikes}
                          onChange={(e) => updateBodyField('dislikes', e.target.value)}
                          placeholder="Ex: marisco, coentros, lactose..."
                        />
                      </label>

                      {dietaryFlags(profile).length > 0 && (
                        <ul className="col-span-2 space-y-2">
                          {dietaryFlags(profile).map((flag, i) => (
                            <li
                              key={i}
                              className="text-xs text-nourish-text-dim leading-relaxed rounded-xl border border-nourish-border bg-nourish-surface-high px-3 py-2"
                            >
                              {flag}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
                {bodyOpen && !profileEnabled && (
                  <p className="border-t border-nourish-border px-4 py-3 text-xs text-nourish-text-dim animate-soft-fade">
                    Activa para configurar os teus dados.
                  </p>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="bg-nourish-surface border border-nourish-border rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setGoalsOpen((v) => !v)}
                    className="flex-1 min-w-0 text-left focus:outline-none"
                    aria-expanded={goalsOpen}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-nourish-text">Objectivos</p>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide ${
                          targetsEnabled ? 'text-nourish-primary' : 'text-nourish-text-dim'
                        }`}
                      >
                        {targetsEnabled ? 'Activo' : 'Desactivado'}
                      </span>
                    </div>
                    <p className="text-xs text-nourish-text-dim leading-snug mt-0.5">
                      Opcional · metas diárias para o plano e progresso
                    </p>
                  </button>
                  <IosToggle
                    checked={targetsEnabled}
                    onChange={toggleTargetsEnabled}
                    label="Activar objectivos"
                  />
                </div>
                {goalsOpen && targetsEnabled && (
                  <div className="border-t border-nourish-border p-4 space-y-3 animate-soft-fade">
                    {profileEnabled && (
                      <div>
                        <p className="text-xs font-semibold text-nourish-text mb-1">
                          Com base nos teus dados
                        </p>
                        <p className="text-xs text-nourish-text-dim leading-snug">
                          {profileSummary(profile, recommended)}
                        </p>
                      </div>
                    )}

                    <div
                      key={showTargets ? 'edit' : 'view'}
                      className="grid grid-cols-2 gap-2 text-center text-xs animate-soft-fade"
                    >
                      {showTargets ? (
                        <>
                          <label className="bg-nourish-surface-high rounded-lg py-2 px-2 block">
                            <span className="text-nourish-text-dim">kcal/dia</span>
                            <NumericInput
                              integer
                              min={0}
                              fallback={DEFAULT_TARGETS.caloriesPerDay}
                              className="mt-1 w-full bg-transparent text-center font-bold text-nourish-text tabular-nums text-sm focus:outline-none focus:ring-1 focus:ring-nourish-primary rounded-md"
                              value={targets.caloriesPerDay}
                              onChange={(n) => setTargets({ ...targets, caloriesPerDay: n })}
                            />
                          </label>
                          <label className="bg-nourish-surface-high rounded-lg py-2 px-2 block">
                            <span className="text-nourish-text-dim">Proteína (g)</span>
                            <NumericInput
                              integer
                              min={0}
                              fallback={DEFAULT_TARGETS.proteinPerDay}
                              className="mt-1 w-full bg-transparent text-center font-bold text-nourish-text tabular-nums text-sm focus:outline-none focus:ring-1 focus:ring-nourish-primary rounded-md"
                              value={targets.proteinPerDay}
                              onChange={(n) => setTargets({ ...targets, proteinPerDay: n })}
                            />
                          </label>
                          <label className="bg-nourish-surface-high rounded-lg py-2 px-2 block">
                            <span className="text-nourish-text-dim">Hidratos (g)</span>
                            <NumericInput
                              integer
                              min={0}
                              fallback={DEFAULT_TARGETS.carbsPerDay}
                              className="mt-1 w-full bg-transparent text-center font-bold text-nourish-text tabular-nums text-sm focus:outline-none focus:ring-1 focus:ring-nourish-primary rounded-md"
                              value={targets.carbsPerDay}
                              onChange={(n) => setTargets({ ...targets, carbsPerDay: n })}
                            />
                          </label>
                          <label className="bg-nourish-surface-high rounded-lg py-2 px-2 block">
                            <span className="text-nourish-text-dim">Gordura (g)</span>
                            <NumericInput
                              integer
                              min={0}
                              fallback={DEFAULT_TARGETS.fatPerDay}
                              className="mt-1 w-full bg-transparent text-center font-bold text-nourish-text tabular-nums text-sm focus:outline-none focus:ring-1 focus:ring-nourish-primary rounded-md"
                              value={targets.fatPerDay}
                              onChange={(n) => setTargets({ ...targets, fatPerDay: n })}
                            />
                          </label>
                        </>
                      ) : (
                        <>
                          <div className="bg-nourish-surface-high rounded-lg py-2">
                            <p className="text-nourish-text-dim">kcal/dia</p>
                            <p className="font-bold text-nourish-text tabular-nums">{targets.caloriesPerDay}</p>
                          </div>
                          <div className="bg-nourish-surface-high rounded-lg py-2">
                            <p className="text-nourish-text-dim">Proteína</p>
                            <p className="font-bold text-nourish-text tabular-nums">{targets.proteinPerDay} g</p>
                          </div>
                          <div className="bg-nourish-surface-high rounded-lg py-2">
                            <p className="text-nourish-text-dim">Hidratos</p>
                            <p className="font-bold text-nourish-text tabular-nums">{targets.carbsPerDay} g</p>
                          </div>
                          <div className="bg-nourish-surface-high rounded-lg py-2">
                            <p className="text-nourish-text-dim">Gordura</p>
                            <p className="font-bold text-nourish-text tabular-nums">{targets.fatPerDay} g</p>
                          </div>
                        </>
                      )}
                    </div>

                    {showTargets && profileEnabled && (
                      <button
                        type="button"
                        onClick={() => setTargets(recommended)}
                        className="w-full text-xs text-nourish-text-dim underline focus:outline-none animate-soft-fade"
                      >
                        Recalcular a partir dos dados pessoais
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowTargets((v) => !v)}
                      className="w-full text-xs text-nourish-text-dim underline focus:outline-none"
                    >
                      {showTargets ? 'Concluir ajuste' : 'Ajustar objectivos manualmente'}
                    </button>
                  </div>
                )}
                {goalsOpen && !targetsEnabled && (
                  <p className="border-t border-nourish-border px-4 py-3 text-xs text-nourish-text-dim animate-soft-fade">
                    Activa para definir as metas diárias.
                  </p>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="bg-nourish-surface border border-nourish-border rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setCarsOpen((v) => !v)}
                    className="flex-1 min-w-0 text-left focus:outline-none"
                    aria-expanded={carsOpen}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-nourish-text">Viatura</p>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide ${
                          carsEnabled ? 'text-nourish-primary' : 'text-nourish-text-dim'
                        }`}
                      >
                        {carsEnabled ? 'Activo' : 'Desactivado'}
                      </span>
                    </div>
                    <p className="text-xs text-nourish-text-dim leading-snug mt-0.5">
                      Opcional · custo de combustível nas idas ao supermercado
                    </p>
                  </button>
                  <HelpInfo
                    title="Porquê a viatura?"
                    label="Porquê a viatura?"
                    sections={[
                      {
                        title: 'Custo das compras',
                        body: 'Com o consumo e o combustível estimamos o custo de cada viagem Casa → supermercado, além do valor do talão.',
                      },
                      {
                        title: 'Distância e preço',
                        body: 'Os km ida/volta vêm do percurso nas estradas (ou das zonas HA). O preço do combustível vem da DGEG (precoscombustiveis.dgeg.gov.pt); nos bicombustíveis usamos o GPL Auto.',
                      },
                    ]}
                  />
                  <IosToggle
                    checked={carsEnabled}
                    onChange={toggleCarsEnabled}
                    label="Activar viatura"
                  />
                </div>
                {carsOpen && (
                  <div
                    className={`border-t border-nourish-border p-4 space-y-3 animate-soft-fade ${
                      carsEnabled ? '' : 'opacity-50'
                    }`}
                  >
                    {fuelPrices && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          {(
                            [
                              { key: 'diesel' as const, label: 'Gasóleo', value: fuelPrices.diesel_eur_per_l },
                              {
                                key: 'gasoline' as const,
                                label: 'Gasolina 95',
                                value: fuelPrices.gasoline_eur_per_l,
                              },
                              { key: 'gpl' as const, label: 'GPL', value: fuelPrices.gpl_eur_per_l },
                            ] as const
                          ).map(({ key, label, value }) => (
                            <div
                              key={key}
                              className="rounded-lg bg-nourish-bg border border-nourish-border py-2 px-1"
                            >
                              <p className="text-nourish-text-dim">{label}</p>
                              {value != null ? (
                                <p className="font-bold text-nourish-primary tabular-nums">
                                  €{value.toFixed(3)}/L
                                </p>
                              ) : (
                                <p className="font-bold text-amber-400/90 text-[11px] leading-tight mt-0.5">
                                  Sem dados DGEG
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                        {fuelPrices.missing && fuelPrices.missing.length > 0 && (
                          <div className="space-y-1.5">
                            {fuelPrices.missing.map((fuel) => (
                              <FuelMissingReport
                                key={fuel}
                                fuel={fuel}
                                onReported={() => refreshFuel()}
                              />
                            ))}
                          </div>
                        )}
                        {fuelPricesUpdatedLabel && (
                          <p className="text-[11px] text-nourish-text-dim text-center leading-snug">
                            Fonte:{' '}
                            {fuelPrices.source_label ?? 'DGEG · precoscombustiveis.dgeg.gov.pt'}
                            <br />
                            Actualizado a {fuelPricesUpdatedLabel}
                          </p>
                        )}
                      </div>
                    )}
                    {!fuelPrices && (
                      <div className="rounded-xl border border-amber-800/40 bg-amber-900/20 p-3 space-y-2">
                        <p className="text-xs text-amber-200/90 leading-snug">
                          Preços DGEG indisponíveis — sem estimativas. Podes reportar o problema.
                        </p>
                        <FuelMissingReport fuel="gpl" label="Reportar problema" onReported={() => refreshFuel()} />
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
                            disabled={!carsEnabled}
                            className="inline-flex items-center gap-1 text-xs text-red-400 focus:outline-none disabled:opacity-50"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
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
                              disabled={!carsEnabled}
                              onChange={(n) => updateCar(car.id, { consumption_l100km: n })}
                            />
                          </label>
                          <label className="text-[10px] text-nourish-text-dim">
                            Combustível
                            <select
                              className={`${inputClass} mt-0.5 text-xs py-1.5`}
                              value={car.fuel_type ?? 'diesel'}
                              disabled={!carsEnabled}
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
                        disabled={!carsEnabled}
                        className="w-full py-2.5 rounded-xl border border-dashed border-nourish-border text-sm text-nourish-primary font-medium disabled:opacity-50"
                      >
                        + Adicionar viatura
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {!loading && !error && tab === 'definicoes' && (
          <>
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-nourish-primary uppercase tracking-wider">
                Aparência
              </h2>
              <div className="rounded-2xl border border-nourish-border bg-nourish-surface divide-y divide-nourish-border">
                <div className="flex items-center justify-between gap-3 p-4">
                  <p className="text-sm font-medium text-nourish-text min-w-0">
                    Mostrar porções nas Refeições
                  </p>
                  <IosToggle
                    checked={prefs.showMealPortions}
                    onChange={(next) => updatePref('showMealPortions', next)}
                    label="Mostrar porções nas Refeições"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => updatePref('hidePrices', !prefs.hidePrices)}
                    className="flex-1 min-w-0 text-left focus:outline-none"
                  >
                    <p className="text-sm font-medium text-nourish-text">
                      Ocultar Preços
                    </p>
                  </button>
                  <IosToggle
                    checked={prefs.hidePrices}
                    onChange={(next) => updatePref('hidePrices', next)}
                    label="Ocultar Preços"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => updatePref('hideNutrition', !prefs.hideNutrition)}
                    className="flex-1 min-w-0 text-left focus:outline-none"
                  >
                    <p className="text-sm font-medium text-nourish-text">
                      Ocultar Nutrição
                    </p>
                  </button>
                  <IosToggle
                    checked={prefs.hideNutrition}
                    onChange={(next) => updatePref('hideNutrition', next)}
                    label="Ocultar Nutrição"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => updatePref('hideProductsWithoutImage', !prefs.hideProductsWithoutImage)}
                    className="flex-1 min-w-0 text-left focus:outline-none"
                  >
                    <p className="text-sm font-medium text-nourish-text">
                      Ocultar Produtos sem Imagem
                    </p>
                  </button>
                  <IosToggle
                    checked={prefs.hideProductsWithoutImage}
                    onChange={(next) => updatePref('hideProductsWithoutImage', next)}
                    label="Ocultar Produtos sem Imagem"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <p className="text-sm font-medium text-nourish-text flex-shrink-0">
                    Vista das refeições
                  </p>
                  <SegmentedControl
                    ariaLabel="Vista das refeições"
                    value={prefs.mealListView}
                    onChange={(next) => updatePref('mealListView', next)}
                    options={[
                      { key: 'cards', label: 'Grelha' },
                      { key: 'list', label: 'Compacta' },
                    ]}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <p className="text-sm font-medium text-nourish-text flex-shrink-0">
                    Ecrã inicial
                  </p>
                  <SegmentedControl
                    ariaLabel="Ecrã inicial"
                    value={prefs.defaultTab}
                    onChange={(next) => updatePref('defaultTab', next)}
                    options={[
                      { key: 'plan', label: 'Planear' },
                      { key: 'meals', label: 'Refeições' },
                    ]}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-1">
                <h2 className="text-xs font-semibold text-nourish-primary uppercase tracking-wider">
                  Supermercados
                </h2>
                <HelpInfo
                  title="Acompanhar vs Ignorar"
                  label="Ajuda supermercados"
                  sections={[
                    {
                      title: 'Acompanhar',
                      body: 'Cria uma zona no Home Assistant. Se estiveres no local (≤250 m), também regista a ida; à distância só passa a acompanhar.',
                    },
                    {
                      title: 'Ignorar',
                      body: 'Não cria zona e a app deixa de sugerir esse sítio. Não entra no historial de idas.',
                    },
                    {
                      title: 'Estou aqui',
                      body: 'Lista supers perto de ti. Se já acompanhas esse sítio, podes “Registar ida agora”.',
                    },
                  ]}
                />
              </div>
              <div className="rounded-2xl border border-nourish-border bg-nourish-surface divide-y divide-nourish-border">
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-nourish-text">Dias entre compras</p>
                    <p className="text-[11px] text-nourish-text-dim mt-0.5">
                      {hasShopIntervalMedian(homelabMetrics)
                        ? 'Mediana · últimos 90 dias'
                        : 'Estimativa (sem historial suficiente)'}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-nourish-primary tabular-nums flex-shrink-0">
                    {shopIntervalDays(homelabMetrics)}
                  </p>
                </div>
                {homelabMetricsError && (
                  <p className="px-4 py-2 text-xs text-amber-600/90">
                    Intervalo não carregou — verifica /nourish/metrics
                  </p>
                )}
                <div className="p-4 border-t border-nourish-border">
                  <SupermarketSearchAdd
                    onChanged={refreshSupermarkets}
                    known={knownSupermarkets}
                    tracked={supermarkets?.tracked ?? []}
                  />
                </div>
                <div className="p-4 space-y-4">
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
                            {supermarkets.tracked.map((s) => {
                              const hasCoords =
                                typeof s.latitude === 'number' &&
                                typeof s.longitude === 'number' &&
                                Number.isFinite(s.latitude) &&
                                Number.isFinite(s.longitude)
                              return (
                                <li
                                  key={s.place_key}
                                  className="flex items-center gap-1 text-sm text-nourish-text min-h-[36px]"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate">{s.name}</p>
                                    {!hasCoords && (
                                      <p className="text-[10px] text-amber-500/90 truncate">
                                        Sem GPS — pesquisa e acompanha o sítio certo
                                      </p>
                                    )}
                                  </div>
                                  {hasCoords ? (
                                    <a
                                      href={mapsUrl({
                                        latitude: s.latitude,
                                        longitude: s.longitude,
                                        name: s.name,
                                      })}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={iconBtnClass}
                                      aria-label={`Ver ${s.name} no mapa`}
                                      title="Ver no mapa"
                                    >
                                      <MapPinIcon />
                                    </a>
                                  ) : (
                                    <span
                                      className={`${iconBtnClass} opacity-30`}
                                      title="Sem coordenadas"
                                      aria-hidden
                                    >
                                      <MapPinIcon />
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (await removeTracked(s.place_key)) refreshSupermarkets()
                                    }}
                                    className={`${iconBtnClass} text-red-400`}
                                    aria-label={`Remover ${s.name}`}
                                    title="Remover"
                                  >
                                    <TrashIcon />
                                  </button>
                                </li>
                              )
                            })}
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
                                className="flex items-center gap-1 text-sm text-nourish-text-dim min-h-[36px]"
                              >
                                <span className="truncate flex-1 min-w-0">{b.name}</span>
                                <a
                                  href={mapsUrl({ name: b.name })}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={iconBtnClass}
                                  aria-label={`Ver ${b.name} no mapa`}
                                  title="Ver no mapa"
                                >
                                  <MapPinIcon />
                                </a>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (await unblockPlace(b.place_key)) refreshSupermarkets()
                                  }}
                                  className={`${iconBtnClass} text-red-400`}
                                  aria-label={`Remover ${b.name}`}
                                  title="Remover"
                                >
                                  <TrashIcon />
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
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-semibold text-nourish-primary uppercase tracking-wider">
                  App
                </h2>
                <HelpInfo
                  title="Actualizar ou reparar"
                  label="Ajuda sobre actualizar e reparar a app"
                  sections={[
                    {
                      title: 'Verificar atualização',
                      body: 'Procura uma versão nova da app (PWA). Usa quando a interface parece desatualizada ou falta uma funcionalidade recente.',
                    },
                    {
                      title: 'Reparar app',
                      body: 'Limpa a cache e o service worker e recarrega. Usa quando vês “Failed to fetch” ou a app não liga ao servidor.',
                    },
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void nudgeServiceWorkerUpdate()}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold border border-nourish-border text-nourish-text active:bg-nourish-surface-high focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                >
                  Verificar atualização
                </button>
                <button
                  type="button"
                  onClick={() => void clearPwaCachesAndReload()}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-nourish-primary text-nourish-on-primary active:opacity-90 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                >
                  Reparar app
                </button>
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

      <BottomNav />
    </div>
  )
}
