import { useEffect, useState } from 'react'
import { BottomSheet } from './BottomSheet'

interface Props {
  supermarketName: string
  open: boolean
  busy?: boolean
  error?: string | null
  onClose: () => void
  onIgnore: () => void | Promise<void>
}

export function VisitIgnoreSheet({
  supermarketName,
  open,
  busy = false,
  error,
  onClose,
  onIgnore,
}: Props) {
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (open) setConfirming(false)
  }, [open, supermarketName])

  function handleClose() {
    setConfirming(false)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={handleClose} ariaLabel="Ignorar supermercado">
      <div className="px-4 pb-1 space-y-3">
        <div>
          <p className="text-sm font-semibold text-nourish-text truncate">{supermarketName}</p>
          <p className="text-xs text-nourish-text-dim mt-0.5 leading-snug">
            Ignorar este super esconde as idas no historial. Podes reverter em Perfil → Ignorados.
          </p>
        </div>

        {error && (
          <p className="text-[11px] text-amber-500 leading-snug">{error}</p>
        )}

        <div className="space-y-2">
          {!confirming ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="w-full py-3 rounded-xl text-sm font-semibold border border-nourish-border text-nourish-text disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            >
              Ignorar
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onIgnore()}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              {busy ? 'A ignorar…' : `Ignorar ${supermarketName}`}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handleClose}
            className="w-full py-3 rounded-xl border border-nourish-border text-nourish-text-dim text-sm font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          >
            Cancelar
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
