import { useMemo, useState } from 'react'
import { filterGenericoSuggestions } from '../utils/genericoSuggestions'

const inputClass =
  'w-full px-3 py-2 bg-nourish-surface-high border border-nourish-border rounded-lg text-nourish-text text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary'

interface Props {
  value: string
  onChange: (value: string) => void
  known: string[]
  placeholder?: string
  id?: string
}

/** Text input + local suggestions from existing Generico / cooking names. */
export function GenericoAutocomplete({
  value,
  onChange,
  known,
  placeholder = 'ex: Cogumelos',
  id,
}: Props) {
  const [open, setOpen] = useState(false)
  const suggestions = useMemo(
    () => filterGenericoSuggestions(value, known, 8),
    [value, known]
  )

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Allow click on suggestion before closing
          window.setTimeout(() => setOpen(false), 150)
        }}
        placeholder={placeholder}
        className={inputClass}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-40 overflow-auto rounded-lg border border-nourish-border bg-nourish-surface shadow-lg">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm text-nourish-text hover:bg-nourish-surface-high"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s)
                  setOpen(false)
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
