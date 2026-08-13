import { useState } from 'react'
import { captureLocalityHere, type Coords } from '../utils/locality'

interface Props {
  location: string
  coords: Coords | null
  onChange: (location: string, coords: Coords | null) => void
  labelClass: string
  inputClass: string
}

export function MealLocalityField({ location, coords, onChange, labelClass, inputClass }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleHere() {
    setLoading(true)
    setError(null)
    try {
      const result = await captureLocalityHere()
      onChange(result.label, result.coords)
    } catch {
      setError('Não foi possível obter a localização.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className={labelClass}>Localidade</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={location}
          onChange={(e) => onChange(e.target.value, coords)}
          placeholder="ex: Condeixa, Coimbra"
          className={`${inputClass} flex-1 min-w-0`}
        />
        <button
          type="button"
          onClick={handleHere}
          disabled={loading}
          className="shrink-0 px-3 py-2 rounded-xl bg-nourish-surface-high border border-nourish-border text-nourish-text text-sm font-semibold disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
        >
          {loading ? '…' : 'Estou aqui'}
        </button>
      </div>
      {coords && (
        <p className="text-[11px] text-nourish-text-dim tabular-nums">
          GPS {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
