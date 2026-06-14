function SparklesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path strokeLinecap="round" d="M20 3v4M22 5h-4" />
    </svg>
  )
}

export const aiButtonClass =
  'w-full mt-2 py-2.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ' +
  'bg-nourish-surface-high border border-nourish-border text-nourish-text active:bg-nourish-border/25 disabled:opacity-50 ' +
  'flex items-center justify-center gap-2'

interface Props {
  loading: boolean
  disabled?: boolean
  onClick: () => void
}

export function AiGenerateButton({ loading, disabled, onClick }: Props) {
  return (
    <button type="button" onClick={onClick} disabled={loading || disabled} className={aiButtonClass}>
      <SparklesIcon />
      {loading ? 'A gerar…' : 'Gerar com IA'}
    </button>
  )
}
