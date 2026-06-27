import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFuelPrices } from '../hooks/useFuelPrices'
import type { Car } from '../hooks/useCars'
import type { SupermarketVisit } from '../utils/supermarketVisits'
import type { VisitCarLink } from '../utils/visitCars'
import { linkCarToVisit, unlinkCarFromVisit } from '../utils/visitCars'
import { inferDefaultCarId } from '../utils/defaultCar'
import { fetchTripDistance } from '../utils/tripDistance'
import { fetchVisitCars } from '../utils/visitCars'
import { VisitTripDetails } from './VisitTripDetails'

interface Props {
  visit: SupermarketVisit
  cars: Car[]
  supermarketName: string
  currentLink?: VisitCarLink
  onClose: () => void
  onSaved: (link: VisitCarLink | null) => void
}

export function VisitCarSheet({ visit, cars, supermarketName, currentLink, onClose, onSaved }: Props) {
  const { priceForCar } = useFuelPrices()
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [routedKm, setRoutedKm] = useState<number | null>(visit.trip_distance_km ?? null)

  useEffect(() => {
    if (currentLink?.car_id) {
      setSelectedId(currentLink.car_id)
      return
    }
    void fetchVisitCars().then((links) => {
      const inferred = inferDefaultCarId(cars, links)
      if (inferred) setSelectedId(inferred)
    })
  }, [currentLink?.car_id, cars])

  useEffect(() => {
    if (visit.trip_distance_km != null) {
      setRoutedKm(visit.trip_distance_km)
      return
    }
    void fetchTripDistance(visit.zone).then((d) => {
      if (d) setRoutedKm(d.round_trip_km)
    })
  }, [visit.trip_distance_km, visit.zone])

  const selectedCar = cars.find((c) => c.id === selectedId)
  const isSaved = !!currentLink && currentLink.car_id === selectedId

  async function handleSave() {
    if (!selectedId) return
    setSaving(true)
    try {
      let distanceKm = routedKm ?? visit.trip_distance_km
      if (distanceKm == null && visit.zone) {
        const routed = await fetchTripDistance(visit.zone)
        distanceKm = routed?.round_trip_km
      }
      const car = cars.find((c) => c.id === selectedId)
      const fuelPrice = car ? priceForCar(car) : null
      const link: VisitCarLink = {
        visit_entered_at: visit.entered_at,
        car_id: selectedId,
        linked_at: new Date().toISOString(),
        ...(distanceKm != null ? { distance_km: distanceKm } : {}),
        ...(fuelPrice != null ? { fuel_price_per_l: fuelPrice } : {}),
        ...(car?.fuel_type ? { fuel_type: car.fuel_type } : {}),
      }
      await linkCarToVisit(link)
      onSaved(link)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true)
    try {
      await unlinkCarFromVisit(visit.entered_at)
      onSaved(null)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface rounded-t-2xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-nourish-text">Viatura desta ida</p>
            <p className="text-xs text-nourish-text-dim mt-0.5">
              Km ida/volta de Casa ao super (OSRM, ou linha recta entre zonas HA)
            </p>
          </div>

          {selectedCar && (
            <VisitTripDetails
              car={selectedCar}
              cars={cars}
              visit={visit}
              supermarketName={supermarketName}
              link={currentLink}
              routedKm={routedKm}
              liveFuelPrice={priceForCar(selectedCar)}
              saved={isSaved}
            />
          )}

          {cars.length === 0 ? (
            <div className="rounded-xl border border-nourish-border bg-nourish-bg p-4 text-center space-y-2">
              <p className="text-sm text-nourish-text-dim">Ainda não tens viaturas registadas.</p>
              <Link
                to="/profile"
                state={{ tab: 'viaturas' }}
                onClick={onClose}
                className="inline-block text-sm font-semibold text-nourish-primary"
              >
                Adicionar em Perfil → Viaturas
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {cars.map((car) => (
                <label
                  key={car.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedId === car.id
                      ? 'border-nourish-primary bg-nourish-primary/10'
                      : 'border-nourish-border bg-nourish-surface-high'
                  }`}
                >
                  <input
                    type="radio"
                    name="visit-car"
                    checked={selectedId === car.id}
                    onChange={() => setSelectedId(car.id)}
                    className="border-nourish-border"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-nourish-text">{car.name}</p>
                    <p className="text-xs text-nourish-text-dim">
                      {car.consumption_l100km} L/100 km
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {currentLink && (
              <button
                type="button"
                onClick={handleClear}
                disabled={saving}
                className="flex-1 py-3 rounded-xl border border-nourish-border text-nourish-text-dim text-sm font-medium focus:outline-none disabled:opacity-50"
              >
                Remover
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-nourish-border text-nourish-text-dim text-sm font-medium focus:outline-none"
            >
              Cancelar
            </button>
            {cars.length > 0 && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!selectedId || saving}
                className="flex-1 py-3 rounded-xl bg-nourish-primary text-nourish-on-primary text-sm font-semibold focus:outline-none disabled:opacity-50"
              >
                Guardar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
