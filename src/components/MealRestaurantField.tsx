import { useState } from 'react'
import type { Coords } from '../utils/locality'
import { suggestRestaurantAt } from '../utils/locality'
import { getCurrentPosition } from '../utils/supermarketSearch'

interface Props {
  restaurant: string
  coords: Coords | null
  onChange: (restaurant: string, coords: Coords | null) => void
  labelClass: string
  inputClass: string
}

/** Eat-out identity: typed restaurant name. GPS is optional, used for distance. */
export function MealRestaurantField({
  restaurant,
  coords,
  onChange,
  labelClass,
  inputClass,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  async function handleHere() {
    setLoading(true)
    setGpsError(null)
    try {
      const next = await getCurrentPosition()
      let name = restaurant
      if (!name.trim()) {
        const suggested = await suggestRestaurantAt(next)
        if (suggested) name = suggested
      }
      onChange(name, next)
    } catch {
      setGpsError('Não foi possível obter a localização.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className={labelClass}>
        Restaurante
      </label>
      <input
        type="text"
        value={restaurant}
        onChange={(e) => onChange(e.target.value, coords)}
        placeholder="ex: Cantina do ISCTE"
        autoComplete="off"
        enterKeyHint="done"
        className={inputClass}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleHere}
          disabled={loading}
          title="Guardar GPS para mostrar a distância"
          aria-label="Guardar GPS para mostrar a distância"
          className="shrink-0 px-3 py-2 rounded-xl bg-nourish-surface-high border border-nourish-border text-nourish-text text-sm font-semibold disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
        >
          {loading ? '…' : 'Estou aqui'}
        </button>
        {coords && (
          <p className="text-[11px] text-nourish-text-dim leading-snug">
            GPS guardado para a distância
          </p>
        )}
      </div>
      {gpsError && <p className="text-xs text-red-400">{gpsError}</p>}
    </div>
  )
}
