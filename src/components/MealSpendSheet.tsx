import type { MealSpendRow } from '../utils/mealStats'
import { formatTripCost } from '../utils/visitTripCost'

interface Props {
  meals: MealSpendRow[]
  periodLabel: string
  totalSpendEur: number
  onClose: () => void
}

export function MealSpendSheet({ meals, periodLabel, totalSpendEur, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface rounded-t-2xl max-h-[min(85vh,640px)] flex flex-col"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-nourish-border/60 shrink-0">
          <p className="text-sm font-semibold text-nourish-text">Refeições registadas</p>
          <p className="text-xs text-nourish-text-dim mt-0.5">
            {periodLabel} · {formatTripCost(totalSpendEur)} · {meals.length} registo
            {meals.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="overflow-y-auto p-4 space-y-2 flex-1 min-h-0">
          {meals.length === 0 ? (
            <p className="text-sm text-nourish-text-dim text-center py-8">
              Sem refeições registadas neste período.
            </p>
          ) : (
            meals.map((meal) => (
              <div
                key={meal.id}
                className="rounded-xl border border-nourish-border bg-nourish-bg p-3 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-nourish-text leading-snug">
                    {meal.recipeName}
                  </p>
                  {meal.priceEur != null ? (
                    <span className="text-sm font-bold tabular-nums text-nourish-primary shrink-0">
                      {formatTripCost(meal.priceEur)}
                    </span>
                  ) : (
                    <span className="text-xs text-nourish-text-dim shrink-0">Sem preço</span>
                  )}
                </div>
                <p className="text-xs text-nourish-text tabular-nums">
                  {meal.dayLabel}
                  {meal.mealType && meal.time && (
                    <span className="text-nourish-text-dim">
                      {' '}
                      · {meal.mealType} · {meal.time}
                    </span>
                  )}
                  {meal.mealType && !meal.time && (
                    <span className="text-nourish-text-dim"> · {meal.mealType}</span>
                  )}
                  {!meal.mealType && meal.time && (
                    <span className="text-nourish-text-dim"> · {meal.time}</span>
                  )}
                </p>
                {meal.calories != null && meal.calories > 0 && (
                  <p className="text-xs text-nourish-text-dim tabular-nums">
                    {Math.round(meal.calories)} kcal
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <div className="px-4 pt-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl border border-nourish-border text-nourish-text-dim text-sm font-medium focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
