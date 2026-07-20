import { MEAL_ORIGINS, type MealOrigin } from '../utils/mealOrigin'

interface Props {
  value: MealOrigin
  onChange: (next: MealOrigin) => void
  labelClass?: string
}

export function MealOriginField({ value, onChange, labelClass = '' }: Props) {
  return (
    <div>
      <label className={labelClass || 'block text-sm font-medium text-nourish-text mb-1.5'}>
        Origem
      </label>
      <div
        className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-nourish-surface border border-nourish-border"
        role="tablist"
        aria-label="Origem da refeição"
      >
        {MEAL_ORIGINS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={value === key}
            onClick={() => onChange(key)}
            className={`py-2 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
              value === key
                ? 'bg-nourish-primary text-nourish-on-primary'
                : 'text-nourish-text-dim'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-nourish-text-dim mt-1.5">
        {value === 'restaurante'
          ? 'Refeição fora — sem ingredientes nem passos de preparação.'
          : 'Cozinhas em casa com ingredientes do supermercado.'}
        {' '}Sugerido pela presença no Home Assistant; podes alterar.
      </p>
    </div>
  )
}
