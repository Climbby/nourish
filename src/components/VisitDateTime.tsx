import type { SupermarketVisit } from '../utils/supermarketVisits'
import {
  formatVisitDayNumber,
  formatVisitWeekday,
  visitClockRange,
} from '../utils/supermarketVisits'

interface Props {
  visit: SupermarketVisit
  supermarketName?: string
}

export function VisitDateTime({ visit, supermarketName }: Props) {
  const weekday = formatVisitWeekday(visit.entered_at)
  const day = formatVisitDayNumber(visit.entered_at)
  const { enter, exit } = visitClockRange(visit)

  return (
    <div className="min-w-0">
      {supermarketName && (
        <p className="text-sm font-semibold text-nourish-text leading-snug truncate mb-1.5">
          {supermarketName}
        </p>
      )}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex flex-col items-center justify-center w-12 shrink-0 rounded-xl bg-nourish-primary/10 border border-nourish-primary/25 py-1.5"
          aria-hidden
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-nourish-primary leading-none">
            {weekday}
          </span>
          <span className="text-xl font-bold tabular-nums text-nourish-text leading-none mt-1">
            {day}
          </span>
        </div>

        <div className="w-px self-stretch min-h-[2.25rem] bg-nourish-border/50 shrink-0" aria-hidden />

        <div className="min-w-0 flex items-baseline gap-1.5 text-sm tabular-nums leading-none">
          <span className="font-semibold text-nourish-text">{enter}</span>
          {exit ? (
            <>
              <span className="text-nourish-border" aria-hidden>
                →
              </span>
              <span className="font-semibold text-nourish-text">{exit}</span>
            </>
          ) : (
            <span className="text-xs font-medium text-nourish-text-dim">sem saída</span>
          )}
        </div>
      </div>
    </div>
  )
}
