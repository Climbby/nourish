interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name when no visible label wraps the control */
  label?: string
  className?: string
  disabled?: boolean
}

/** Custom checkbox — avoids native OS styling. */
export function Checkbox({ checked, onChange, label, className = '', disabled }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative flex-shrink-0 w-[18px] h-[18px] rounded-[5px] border transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-offset-1 focus:ring-offset-nourish-surface disabled:opacity-40 ${
        checked
          ? 'bg-nourish-primary border-nourish-primary'
          : 'bg-nourish-bg border-nourish-border'
      } ${className}`}
    >
      {checked && (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute inset-0 m-auto w-3 h-3 text-nourish-on-primary"
          aria-hidden
        >
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      )}
    </button>
  )
}
