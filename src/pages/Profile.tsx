import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { MealPlanEntry, Recipe } from '../types/grocy'
import { BottomNav } from '../components/BottomNav'
import { NumericInput } from '../components/NumericInput'
import { Spinner } from '../components/Spinner'
import { useFavourites } from '../hooks/useFavourites'
import { useNutritionTargets, DEFAULT_TARGETS } from '../hooks/useNutritionTargets'
import { useUserProfile, DEFAULT_USER_PROFILE } from '../hooks/useUserProfile'
import {
  aggregateMealStats,
  filterMealPlanByPeriod,
  getPeriodMeta,
  macroGaps,
  macroSurpluses,
  pickNutritionRecommendation,
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
  type HomelabMetrics,
} from '../api/homelabMetrics'

const PERIODS: { key: StatsPeriod; short: string }[] = [
  { key: '7d', short: '7 dias' },
  { key: '30d', short: '30 dias' },
  { key: 'month', short: 'Mês' },
]

const inputClass =
  'w-full px-3 py-2 bg-nourish-surface border border-nourish-border rounded-xl text-nourish-text text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary'

export function Profile() {
  const navigate = useNavigate()
  const { favourites } = useFavourites()
  const { targets, setTargets, resetTargets } = useNutritionTargets()
  const { profile, updateField } = useUserProfile()
  const [period, setPeriod] = useState<StatsPeriod>('7d')
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTargets, setShowTargets] = useState(false)
  const [showBody, setShowBody] = useState(false)
  const [homelabMetrics, setHomelabMetrics] = useState<HomelabMetrics | null>(null)
  const [homelabMetricsError, setHomelabMetricsError] = useState(false)

  useEffect(() => {
    fetchHomelabMetrics().then((m) => {
      setHomelabMetrics(m)
      setHomelabMetricsError(m === null)
    })
  }, [])

  const recommended = useMemo(() => recommendedDailyTargets(profile), [profile])

  useEffect(() => {
    let mounted = true
    Promise.all([grocy.getMealPlan(), grocy.getRecipes()])
      .then(([plan, list]) => {
        if (!mounted) return
        setMealPlan(plan)
        setRecipes(list)
      })
      .catch((e: Error) => { if (mounted) setError(e.message) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const periodMeta = getPeriodMeta(period)
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

  const recommendation = useMemo(() => {
    if (recipes.length === 0) return null
    return pickNutritionRecommendation(
      { recipes, favourites, mealPlan },
      totals,
      targets,
      periodMeta.dayCount
    )
  }, [recipes, favourites, mealPlan, totals, targets, periodMeta.dayCount])

  const avgPerDay = periodMeta.dayCount > 0
    ? {
        calories: Math.round(totals.calories / periodMeta.dayCount),
        protein: Math.round(totals.protein / periodMeta.dayCount),
      }
    : null

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="px-4 pt-12 pb-4 border-b border-nourish-border">
        <h1 className="text-2xl font-bold text-nourish-text">Perfil</h1>
        <p className="text-nourish-text-dim text-sm mt-0.5">Nutrição, gastos e recomendações</p>
      </header>

      <main className="p-4 space-y-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}>
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

        {loading && <Spinner />}

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-xl text-sm">
            Erro ao carregar: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-nourish-primary uppercase tracking-wider mb-1">
                  Objectivos recomendados para ti
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
            </section>

            {surpluses.length > 0 && totals.mealsLogged > 0 && (
              <section className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 space-y-2">
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Acima do objectivo ({periodMeta.label.toLowerCase()})
                </p>
                {surpluses.map((s) => (
                  <div key={s.key}>
                    <p className="text-sm font-medium text-nourish-text">
                      {s.label}: {s.percentOfExpected}% (+{Math.round(s.overBy)} {s.unit})
                    </p>
                    <p className="text-xs text-nourish-text-dim mt-0.5">{SURPLUS_ADVICE[s.key]}</p>
                  </div>
                ))}
              </section>
            )}

            <section className="bg-nourish-surface border border-nourish-border rounded-2xl p-4">
              <p className="text-xs font-semibold text-nourish-primary uppercase tracking-wider mb-2">
                {periodMeta.label}
              </p>
              <p className="text-3xl font-bold text-nourish-text tabular-nums">
                €{totals.spend.toFixed(2)}
              </p>
              <p className="text-sm text-nourish-text-dim mt-0.5">
                Gasto estimado em refeições registadas
                {totals.mealsLogged > 0 && (
                  <> · {totals.mealsLogged} registo{totals.mealsLogged !== 1 ? 's' : ''}</>
                )}
              </p>
              {totals.mealsLogged === 0 && (
                <p className="text-xs text-nourish-border mt-2">
                  Regista refeições em Historial para ver totais. Só contam refeições com nutrição/preço no cartão.
                </p>
              )}
            </section>

            <section className="grid grid-cols-2 gap-2">
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
            </section>

            {avgPerDay && totals.mealsLogged > 0 && (
              <p className="text-xs text-nourish-text-dim text-center">
                Média ~{avgPerDay.calories} kcal e {avgPerDay.protein} g proteína por dia no período
              </p>
            )}

            <button
              type="button"
              onClick={() => setShowTargets((v) => !v)}
              className="w-full text-sm text-nourish-text-dim underline focus:outline-none"
            >
              {showTargets ? 'Ocultar objectivos diários' : 'Ajustar objectivos diários'}
            </button>

            {showTargets && (
              <section className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-3">
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
              </section>
            )}

            {recommendation && (
              <section>
                <p className="text-xs font-semibold text-nourish-primary uppercase tracking-wider mb-2">
                  Recomendação
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/meal/${recommendation.recipe.id}`)}
                  className="w-full p-4 rounded-2xl bg-nourish-surface border border-nourish-primary/30 text-left active:scale-[0.99] transition-transform focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                >
                  <p className="font-semibold text-nourish-text">{recommendation.recipe.name}</p>
                  <p className="text-xs text-nourish-text-dim mt-1 leading-snug">{recommendation.reason}</p>
                </button>
              </section>
            )}

            <section className="rounded-2xl border border-nourish-border bg-nourish-surface p-4">
              <p className="text-xs font-semibold text-nourish-primary uppercase tracking-wider mb-3">
                Casa e supermercado
              </p>
              <div className="text-center mb-4 py-2 rounded-xl bg-nourish-bg border border-nourish-border">
                <p className="text-3xl font-bold text-nourish-primary tabular-nums">
                  {homelabMetrics?.days_until_shop ?? defaultDaysUntilShop()}
                </p>
                <p className="text-xs text-nourish-text-dim mt-1">dias até à próxima ida ao super</p>
                <p className="text-[10px] text-nourish-text-dim mt-1">
                  (igual ao helper no Home Assistant; altera em Definições → Helpers)
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
                    Lista automática ao sair: ~{homelabMetrics.suggested_days_until_shop} dias de despensa
                  </p>
                </>
              )}
            </section>

            <section className="rounded-xl border border-nourish-border bg-nourish-surface/50 p-3 space-y-2">
              <p className="text-xs text-nourish-text-dim leading-snug">
                <span className="font-semibold text-nourish-text">Sugestão na página inicial</span> usa regras
                simples (porções prontas, favoritos, evitar repetir nas últimas 48 h). A recomendação aqui cruza isso
                com o que registaste, excessos de nutrientes e os teus objectivos.
              </p>
              <p className="text-xs text-nourish-text-dim leading-snug">
                <span className="font-semibold text-nourish-text">Lista ao sair de casa</span> (Home Assistant + n8n):
                ver <code className="text-[10px]">docs/homelab-smart-shopping.md</code> no projeto.
              </p>
              <Link to="/history" className="inline-block text-sm text-nourish-primary font-medium">
                Ver historial de refeições →
              </Link>
              <Link
                to="/history"
                state={{ tab: 'supermarket' }}
                className="inline-block text-sm text-nourish-primary font-medium"
              >
                Ver historial do supermercado →
              </Link>
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
