/** Claim / owner label for attributed household items. */
export function OwnershipControls({
  ownerLabel,
  showClaim,
  onClaim,
}: {
  ownerLabel: string | null
  /** Show “Atribuir a mim” when this profile is not yet an owner (first claim or Ambos upgrade). */
  showClaim: boolean
  onClaim: () => void
}) {
  return (
    <div className="mt-1.5 space-y-0.5">
      {ownerLabel ? (
        <p className="text-[11px] text-nourish-text-dim">{ownerLabel}</p>
      ) : null}
      {showClaim ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClaim()
          }}
          className="text-[11px] font-semibold text-nourish-primary focus:outline-none"
        >
          Atribuir a mim
        </button>
      ) : null}
    </div>
  )
}
