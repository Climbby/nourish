interface VerifiedBadgeProps {
  verified: boolean
  /** Shown when not verified (e.g. AI estimate). */
  label?: string
  className?: string
}

export function VerifiedBadge({ verified, label = '~est.', className = '' }: VerifiedBadgeProps) {
  if (verified) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-emerald-400 text-[10px] font-semibold uppercase tracking-wide ${className}`}
      >
        <span aria-hidden>✓</span>
        <span className="sr-only">Verificado</span>
      </span>
    )
  }
  return (
    <span
      className={`inline-flex text-amber-400/90 text-[10px] font-medium ${className}`}
    >
      {label}
    </span>
  )
}

interface VerifyCheckboxProps {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}

export function VerifyCheckbox({ id, checked, onChange, label, disabled }: VerifyCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 text-xs ${disabled ? 'opacity-40' : 'text-nourish-text-dim cursor-pointer'}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-nourish-border text-nourish-primary focus:ring-nourish-primary"
      />
      {label}
    </label>
  )
}
