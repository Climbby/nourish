import type { Car } from '../hooks/useCars'
import { carDisplayName } from '../utils/carDisplayName'
import { fuelTypeLabel } from '../utils/fuelPrices'
import type { SupermarketVisit } from '../utils/supermarketVisits'
import { formatTripRouteLabel } from '../utils/visitSupermarketLabel'
import type { VisitCarLink } from '../utils/visitCars'
import {
  formatFuelPricePerL,
  formatTripCost,
  tripCostEur,
  tripKm,
  tripFuelPrice,
  visitFuelType,
} from '../utils/visitTripCost'

interface Props {
  car: Car
  cars: Car[]
  visit: SupermarketVisit
  supermarketName: string
  link?: VisitCarLink
  routedKm: number | null
  liveFuelPrice: number | null
  /** True when showing snapshotted values from a saved link for this car */
  saved: boolean
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-nourish-text-dim shrink-0">{label}</span>
      <span className="text-nourish-text font-medium tabular-nums text-right">{value}</span>
    </div>
  )
}

export function VisitTripDetails({
  car,
  cars,
  visit,
  supermarketName,
  link,
  routedKm,
  liveFuelPrice,
  saved,
}: Props) {
  const visitSource = { trip_distance_km: routedKm ?? visit.trip_distance_km }
  const effectiveLink = saved ? link : undefined
  const km = tripKm(effectiveLink, visitSource)
  const fuelType = visitFuelType(effectiveLink, car)
  const price = saved ? tripFuelPrice(link) : liveFuelPrice
  const cost = km != null && price != null ? tripCostEur(km, car, price) : null

  return (
    <div className="rounded-xl border border-nourish-primary/25 bg-nourish-primary/5 p-3 space-y-2.5">
      <p className="text-sm font-semibold text-nourish-text">{carDisplayName(car, cars)}</p>
      <div className="space-y-1.5">
        {(km != null || supermarketName) && (
          <DetailRow label="Percurso" value={formatTripRouteLabel(km, supermarketName)} />
        )}
        <DetailRow label="Combustível" value={fuelTypeLabel(fuelType)} />
        {price != null && (
          <DetailRow
            label={saved ? 'Preço na visita' : 'Preço actual'}
            value={formatFuelPricePerL(price)}
          />
        )}
        {cost != null && <DetailRow label="Custo viagem" value={formatTripCost(cost)} />}
      </div>
    </div>
  )
}
