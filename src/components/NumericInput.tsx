import { useEffect, useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number
  onChange: (value: number) => void
  fallback?: number
  integer?: boolean
}

export function NumericInput({
  value,
  onChange,
  fallback = 0,
  integer = false,
  min,
  max,
  className,
  onBlur,
  ...rest
}: Props) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  function commit(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed === '-' || trimmed === '.') {
      onChange(fallback)
      return
    }
    let n = integer ? parseInt(trimmed, 10) : parseFloat(trimmed)
    if (!Number.isFinite(n)) {
      onChange(fallback)
      return
    }
    if (min != null) n = Math.max(Number(min), n)
    if (max != null) n = Math.min(Number(max), n)
    onChange(n)
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      className={className}
      value={focused ? draft : String(value)}
      onFocus={(e) => {
        setDraft(String(value))
        setFocused(true)
        rest.onFocus?.(e)
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        setFocused(false)
        commit(draft)
        onBlur?.(e)
      }}
    />
  )
}
