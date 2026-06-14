import type { NutritionTargets } from '../hooks/useNutritionTargets'
import type { WeekPlanTotals } from '../utils/weeklyNutritionPlan'

interface Props {
  totals: WeekPlanTotals
  targets: NutritionTargets
  days: number
  label?: string
}

export function MacroSummaryBar({ totals, targets, days, label = 'Plano' }: Props) {
  const expectedKcal = targets.caloriesPerDay * days
  const pct = expectedKcal > 0 ? Math.min(100, Math.round((totals.calories / expectedKcal) * 100)) : 0

  return (
    <div className="bg-nourish-surface border border-nourish-border rounded-lg p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-nourish-text">{label}</p>
        <p className="text-xs text-nourish-text-dim tabular-nums">
          {totals.calories.toLocaleString('pt-PT')} / {expectedKcal.toLocaleString('pt-PT')} kcal
        </p>
      </div>
      <div className="h-1.5 bg-nourish-surface-high rounded-sm overflow-hidden">
        <div
          className="h-full bg-nourish-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-2 text-[10px] text-nourish-text-dim tabular-nums">
        <span>{totals.protein}g P</span>
        <span>·</span>
        <span>{totals.carbs}g C</span>
        <span>·</span>
        <span>{totals.fat}g G</span>
        <span className="ml-auto">
          Objectivo: {targets.proteinPerDay}g P · {targets.carbsPerDay}g C · {targets.fatPerDay}g G/dia
        </span>
      </div>
    </div>
  )
}

export function MacroChips({ nutrition }: { nutrition: { protein: number; carbs: number; fat: number; calories: number } }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      <span className="px-1.5 py-0.5 bg-nourish-surface-high rounded text-[10px] text-nourish-text-dim tabular-nums">
        {nutrition.calories} kcal
      </span>
      <span className="px-1.5 py-0.5 bg-nourish-surface-high rounded text-[10px] text-nourish-text-dim tabular-nums">
        {nutrition.protein}g P
      </span>
      <span className="px-1.5 py-0.5 bg-nourish-surface-high rounded text-[10px] text-nourish-text-dim tabular-nums">
        {nutrition.carbs}g C
      </span>
    </div>
  )
}
