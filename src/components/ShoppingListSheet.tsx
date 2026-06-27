import { useCallback, useEffect, useState } from 'react'
import { grocy } from '../api/grocy'
import type { Product, ShoppingListItem } from '../types/grocy'
import { Spinner } from './Spinner'

export function CartIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h15l-1.5 9h-12L6 6Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  )
}

export function ListIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

interface ShoppingListSheetProps {
  open: boolean
  onClose: () => void
  /** Called after list changes (e.g. despensa cards refresh badges). */
  onListChange?: () => void
}

export function ShoppingListButton({
  count,
  onClick,
}: {
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl bg-nourish-surface-high border border-nourish-border text-nourish-text text-xs font-semibold active:bg-nourish-border/20 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
      aria-label="Lista de compras"
    >
      <ListIcon />
      Lista
      {count > 0 && (
        <span className="min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full bg-nourish-primary text-nourish-on-primary text-[10px] font-bold">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

export function ShoppingListSheet({ open, onClose, onListChange }: ShoppingListSheetProps) {
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [products, setProducts] = useState<Map<number, Product>>(new Map())
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sl, prods] = await Promise.all([grocy.getShoppingList(), grocy.getProducts()])
      setItems(sl.filter((i) => !i.done))
      setProducts(new Map(prods.map((p) => [p.id, p])))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const productName = (productId: number) => products.get(productId)?.name ?? `Produto #${productId}`

  const handleDone = async (item: ShoppingListItem) => {
    setBusyId(item.id)
    try {
      await grocy.markShoppingListDone(item)
      await load()
      onListChange?.()
    } finally {
      setBusyId(null)
    }
  }

  const handleRemove = async (item: ShoppingListItem) => {
    setBusyId(item.id)
    try {
      await grocy.removeFromShoppingList(item.id)
      await load()
      onListChange?.()
    } finally {
      setBusyId(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface rounded-t-2xl max-h-[85vh] flex flex-col"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-nourish-border flex items-center justify-between flex-shrink-0">
          <div>
            <p className="font-semibold text-nourish-text">Lista de compras</p>
            <p className="text-xs text-nourish-text-dim mt-0.5">
              {items.length === 0 ? 'Vazia — o check ao sair de casa adiciona aqui' : `${items.length} item${items.length !== 1 ? 's' : ''} por comprar`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-nourish-text-dim rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}

          {!loading && items.length === 0 && (
            <p className="text-sm text-nourish-text-dim text-center py-8">
              Nada na lista. Usa o ícone de lista nos produtos da despensa ou deixa o check ao sair de casa.
            </p>
          )}

          {!loading && items.length > 0 && (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-nourish-surface-high border border-nourish-border rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-nourish-text truncate">{productName(item.product_id)}</p>
                    <p className="text-xs text-nourish-text-dim tabular-nums">× {item.amount}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => handleDone(item)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-50"
                  >
                    Comprado
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => handleRemove(item)}
                    className="p-2 text-nourish-text-dim hover:text-red-400 disabled:opacity-50"
                    aria-label="Remover"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
