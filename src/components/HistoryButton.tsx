import { useNavigate } from 'react-router-dom'

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7v5l3 2" />
    </svg>
  )
}

/** Compact header icon — matches the original Meals history control. */
export function HistoryButton({
  to = '/history',
  label = 'Historial',
}: {
  to?: string
  label?: string
}) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="p-2.5 rounded-lg bg-nourish-surface-high border border-nourish-border text-nourish-text-dim active:bg-nourish-border/20 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
      aria-label={label}
    >
      <ClockIcon />
    </button>
  )
}
