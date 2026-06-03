import type { PriceHistoryPoint } from '../types/grocy'

interface PriceHistoryChartProps {
  points: PriceHistoryPoint[]
}

function parsePriceDate(date: string): number {
  return new Date(date.replace(' ', 'T')).getTime()
}

export function PriceHistoryChart({ points }: PriceHistoryChartProps) {
  const withPrice = points.filter((p) => p.price > 0)
  if (withPrice.length < 2) return null

  const sorted = [...withPrice].sort((a, b) => parsePriceDate(a.date) - parsePriceDate(b.date))
  const prices = sorted.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const w = 280
  const h = 80
  const pad = 4
  const coords = sorted.map((p, i) => {
    const x = pad + (i / (sorted.length - 1)) * (w - pad * 2)
    const y = h - pad - ((p.price - min) / range) * (h - pad * 2)
    return `${x},${y}`
  })

  const latest = sorted[sorted.length - 1]
  const oldest = sorted[0]
  const change =
    oldest.price > 0 ? ((latest.price - oldest.price) / oldest.price) * 100 : null

  return (
    <section className="bg-nourish-surface border border-nourish-border rounded-2xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-nourish-text text-sm">Evolução de preço</h3>
        {change !== null && (
          <span
            className={`text-xs font-semibold tabular-nums ${
              change > 0 ? 'text-amber-400' : change < 0 ? 'text-emerald-400' : 'text-nourish-text-dim'
            }`}
          >
            {change > 0 ? '+' : ''}
            {change.toFixed(0)}% desde {new Date(parsePriceDate(oldest.date)).toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" aria-hidden>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-nourish-primary"
          points={coords.join(' ')}
        />
      </svg>
      <div className="flex justify-between text-xs text-nourish-text-dim mt-2 tabular-nums">
        <span>€{min.toFixed(2)}</span>
        <span className="text-nourish-primary font-semibold">€{latest.price.toFixed(2)}</span>
        <span>€{max.toFixed(2)}</span>
      </div>
    </section>
  )
}
