import type { VisitShoppingTripDetail } from '../utils/visitSpendStats'
import { formatVisitDuration, formatVisitTimeRange } from '../utils/supermarketVisits'
import { formatTripCost } from '../utils/visitTripCost'

interface Props {
  trips: VisitShoppingTripDetail[]
  periodLabel: string
  totalShoppingEur: number
  onClose: () => void
}

export function VisitShoppingTripsSheet({
  trips,
  periodLabel,
  totalShoppingEur,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface rounded-t-2xl max-h-[min(85vh,640px)] flex flex-col"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-nourish-border/60 shrink-0">
          <p className="text-sm font-semibold text-nourish-text">Compras no super</p>
          <p className="text-xs text-nourish-text-dim mt-0.5">
            {periodLabel} · {formatTripCost(totalShoppingEur)} · {trips.length} ida
            {trips.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="overflow-y-auto p-4 space-y-2 flex-1 min-h-0">
          {trips.length === 0 ? (
            <p className="text-sm text-nourish-text-dim text-center py-8">
              Sem idas ao supermercado neste período.
            </p>
          ) : (
            trips.map((trip) => (
              <div
                key={trip.visit.entered_at}
                className="rounded-xl border border-nourish-border bg-nourish-bg p-3 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-nourish-text leading-snug">
                    {trip.destination}
                  </p>
                  {trip.totalEur != null ? (
                    <span className="text-sm font-bold tabular-nums text-nourish-primary shrink-0">
                      {formatTripCost(trip.totalEur)}
                    </span>
                  ) : (
                    <span className="text-xs text-nourish-text-dim shrink-0">Sem talão</span>
                  )}
                </div>
                <p className="text-xs text-nourish-text tabular-nums">
                  {formatVisitTimeRange(trip.visit)}
                  <span className="text-nourish-text-dim">
                    {' '}
                    · {formatVisitDuration(trip.visit.duration_minutes, trip.visit.ongoing)}
                  </span>
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-nourish-text-dim tabular-nums">
                  {trip.itemCount != null && (
                    <span>
                      {trip.itemCount} produto{trip.itemCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {trip.km != null && <span>Casa · {trip.km} km ida/volta</span>}
                </div>
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
