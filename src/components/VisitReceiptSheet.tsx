import { BottomSheet } from './BottomSheet'
import type { VisitReceiptLink } from '../utils/visitReceipts'

const STORE_LABELS: Record<string, string> = {
  mixed: 'Misto',
  continente: 'Continente',
  auchan: 'Auchan',
}

interface Props {
  receipt: VisitReceiptLink
  supermarketName?: string
  onClose: () => void
  onReplace: () => void
}

export function VisitReceiptSheet({ receipt, supermarketName, onClose, onReplace }: Props) {
  const store =
    receipt.store && STORE_LABELS[receipt.store]
      ? STORE_LABELS[receipt.store]
      : receipt.store ?? null
  const lines = receipt.lines ?? []

  return (
    <BottomSheet open onClose={onClose} ariaLabel="Talão da compra">
      <div
        className="flex flex-col max-h-[min(85vh,640px)]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        <div className="p-4 border-b border-nourish-border/60 shrink-0">
          <p className="text-sm font-semibold text-nourish-text">Talão</p>
          <p className="text-xs text-nourish-text-dim mt-0.5">
            {[
              supermarketName,
              store,
              receipt.purchased_date,
              `${receipt.item_count} produto${receipt.item_count !== 1 ? 's' : ''}`,
              receipt.total_eur > 0 ? `€${receipt.total_eur.toFixed(2)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <div className="overflow-y-auto p-4 space-y-2 flex-1 min-h-0">
          {lines.length === 0 ? (
            <p className="text-sm text-nourish-text-dim text-center py-8 leading-snug">
              Este talão foi associado antes de guardarmos as linhas. Podes substituí-lo por um novo
              scan para ver o detalhe.
            </p>
          ) : (
            lines.map((line, i) => (
              <div
                key={`${line.name}-${i}`}
                className="rounded-xl border border-nourish-border bg-nourish-bg p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-nourish-text leading-snug">
                    {line.product_name?.trim() || line.name}
                  </p>
                  {line.product_name && line.product_name !== line.name && (
                    <p className="text-[11px] text-nourish-text-dim truncate mt-0.5">{line.name}</p>
                  )}
                  <p className="text-xs text-nourish-text-dim tabular-nums mt-0.5">
                    {line.qty > 0 && line.qty !== 1
                      ? `${line.qty} × €${line.unit_price.toFixed(2)}`
                      : `€${line.unit_price.toFixed(2)}`}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-nourish-primary shrink-0">
                  €{line.line_total.toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-nourish-border/60 shrink-0 space-y-2">
          <button
            type="button"
            onClick={onReplace}
            className="w-full py-3 rounded-xl border border-nourish-border text-nourish-text text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          >
            Substituir talão
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl border border-nourish-border text-nourish-text-dim text-sm font-medium focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          >
            Fechar
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
