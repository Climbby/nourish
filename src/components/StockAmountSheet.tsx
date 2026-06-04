import { useEffect, useState } from 'react'
import { NumericInput } from './NumericInput'

interface StockAmountSheetProps {
  open: boolean
  productName: string
  amount: number
  saving?: boolean
  onClose: () => void
  onSave: (newAmount: number) => void
  onRemove?: () => void
}

export function StockAmountSheet({
  open,
  productName,
  amount,
  saving = false,
  onClose,
  onSave,
  onRemove,
}: StockAmountSheetProps) {
  const [draft, setDraft] = useState(amount)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(amount)
      setConfirmRemove(false)
    }
  }, [open, amount])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-sm bg-nourish-surface border border-nourish-border rounded-t-2xl p-4 space-y-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        <div className="w-10 h-1 bg-nourish-border rounded-full mx-auto" />
        <h3 className="font-semibold text-nourish-text text-center">{productName}</h3>
        <p className="text-xs text-nourish-text-dim text-center">
          Quantidade real em casa (inventário)
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={saving || draft <= 0}
            onClick={() => setDraft((d) => Math.max(0, d - 1))}
            className="w-12 h-12 rounded-xl bg-nourish-surface-high text-nourish-text font-bold text-lg disabled:opacity-30"
          >
            −
          </button>
          <NumericInput
            value={draft}
            onChange={setDraft}
            integer
            min={0}
            className="w-20 text-center text-2xl font-bold text-nourish-primary tabular-nums bg-nourish-surface-high border border-nourish-border rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            aria-label="Quantidade em stock"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => setDraft((d) => d + 1)}
            className="w-12 h-12 rounded-xl bg-nourish-surface-high text-nourish-text font-bold text-lg"
          >
            +
          </button>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(draft)}
          className="w-full py-3.5 rounded-xl font-semibold text-sm bg-nourish-primary text-nourish-on-primary disabled:opacity-40 active:bg-nourish-primary-dim"
        >
          {saving ? 'A guardar…' : 'Guardar quantidade'}
        </button>

        {onRemove && !confirmRemove && (
          <button
            type="button"
            disabled={saving}
            onClick={() => setConfirmRemove(true)}
            className="w-full py-2 text-sm text-red-400 font-medium"
          >
            Remover da despensa
          </button>
        )}

        {onRemove && confirmRemove && (
          <div className="space-y-2 p-3 rounded-xl bg-red-900/20 border border-red-800/50">
            <p className="text-sm text-red-300 text-center">
              O produto é apagado permanentemente do Grocy. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmRemove(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-surface-high text-nourish-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={onRemove}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white disabled:opacity-40"
              >
                Remover
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="w-full py-2 text-sm text-nourish-text-dim"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
