/** Compact share / claim controls for attributed household items. */
export function OwnershipControls({
  ownerLabel,
  unattributed,
  shared,
  canToggleShare,
  onClaim,
  onToggleShare,
}: {
  ownerLabel: string | null
  unattributed: boolean
  shared: boolean
  canToggleShare: boolean
  onClaim: () => void
  onToggleShare: () => void
}) {
  if (unattributed) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClaim()
        }}
        className="mt-1.5 text-[11px] font-semibold text-nourish-primary focus:outline-none"
      >
        Atribuir a mim
      </button>
    )
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      {ownerLabel && (
        <span className="text-[11px] text-nourish-text-dim">
          {ownerLabel}
          {shared ? ' · família' : ''}
        </span>
      )}
      {canToggleShare && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleShare()
          }}
          className="text-[11px] font-semibold text-nourish-primary focus:outline-none"
        >
          {shared ? 'Deixar de partilhar' : 'Partilhar com a família'}
        </button>
      )}
    </div>
  )
}
