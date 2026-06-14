import { useEffect, useRef, useState } from 'react'
import {
  fuelTypeShortLabel,
  searchCarPresets,
  type CarPreset,
} from '../data/carPresets'

interface Props {
  value: string
  onChange: (name: string) => void
  onSelectPreset?: (preset: CarPreset) => void
  placeholder?: string
  className?: string
}

export function CarModelInput({ value, onChange, onSelectPreset, placeholder, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const suggestions = searchCarPresets(value)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function pick(preset: CarPreset) {
    onChange(preset.label)
    onSelectPreset?.(preset)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHighlight(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === 'Enter' && suggestions[highlight]) {
            e.preventDefault()
            pick(suggestions[highlight])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder={placeholder ?? 'Modelo (ex. Golf)'}
        className={className}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-auto rounded-xl border border-nourish-border bg-nourish-surface shadow-lg py-1">
          {suggestions.map((preset, i) => (
            <li key={preset.label}>
              <button
                type="button"
                onClick={() => pick(preset)}
                className={`w-full px-3 py-2 text-left text-sm ${
                  i === highlight ? 'bg-nourish-primary/15 text-nourish-primary' : 'text-nourish-text'
                }`}
              >
                <span className="font-medium">{preset.label}</span>
                {preset.consumption_l100km > 0 && (
                  <span className="text-nourish-text-dim text-xs ml-2">
                    ~{preset.consumption_l100km} L/100 km
                    {fuelTypeShortLabel(preset.fuel_type)
                      ? ` · ${fuelTypeShortLabel(preset.fuel_type)}`
                      : ''}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && value.trim() && suggestions.length === 0 && (
        <p className="absolute z-20 left-0 right-0 mt-1 px-3 py-2 text-xs text-nourish-text-dim rounded-xl border border-nourish-border bg-nourish-surface">
          Sem sugestão — introduz consumo manualmente
        </p>
      )}
    </div>
  )
}
