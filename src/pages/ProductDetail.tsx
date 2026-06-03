import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { PriceHistoryPoint, Product, StockLogEntry } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { PriceHistoryChart } from '../components/PriceHistoryChart'
import { getBuyAmountFromDesc } from '../utils/despensaAnalytics'

function formatLogDate(ts: string): string {
  const d = new Date(ts.replace(' ', 'T'))
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatLogTime(ts: string): string {
  const d = new Date(ts.replace(' ', 'T'))
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clipRule="evenodd" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.499.058l.346-9Z" clipRule="evenodd" />
    </svg>
  )
}

const HISTORY_LIMIT = 20

export function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const numId = parseInt(id!, 10)

  const [product, setProduct] = useState<Product | null>(null)
  const [amount, setAmount] = useState(0)
  const [log, setLog] = useState<StockLogEntry[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([])
  const [stockValue, setStockValue] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)

  function sortLog(entries: StockLogEntry[]): StockLogEntry[] {
    return [...entries].sort(
      (a, b) =>
        new Date(b.row_created_timestamp.replace(' ', 'T')).getTime() -
        new Date(a.row_created_timestamp.replace(' ', 'T')).getTime()
    )
  }

  useEffect(() => {
    if (isNaN(numId)) {
      setError('ID inválido')
      setLoading(false)
      return
    }
    Promise.all([
      grocy.getProduct(numId),
      grocy.getProductStockAmount(numId),
      grocy.getStockLog(numId),
      grocy.getPriceHistory(numId).catch(() => [] as PriceHistoryPoint[]),
    ])
      .then(([prod, stockSummary, logEntries, history]) => {
        setProduct(prod)
        setAmount(stockSummary.amount)
        setStockValue(
          stockSummary.amount > 0 ? stockSummary.value / stockSummary.amount : null
        )
        setLog(sortLog(logEntries))
        setPriceHistory(history)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [numId])

  async function reloadStockAndLog() {
    const [stockSummary, newLog, history] = await Promise.all([
      grocy.getProductStockAmount(numId),
      grocy.getStockLog(numId),
      grocy.getPriceHistory(numId).catch(() => [] as PriceHistoryPoint[]),
    ])
    setAmount(stockSummary.amount)
    setStockValue(
      stockSummary.amount > 0 ? stockSummary.value / stockSummary.amount : null
    )
    setLog(sortLog(newLog))
    setPriceHistory(history)
  }

  async function handleConsume() {
    if (amount <= 0) return
    setAmount((a) => Math.max(0, a - 1))
    try {
      await grocy.consumeStock(numId, 1)
      await reloadStockAndLog()
    } catch {
      await reloadStockAndLog()
    }
  }

  async function handleAdd() {
    const ba = getBuyAmountFromDesc(product?.description ?? null, numId)
    setAmount((a) => a + ba)
    try {
      await grocy.addStock(numId, ba)
      await reloadStockAndLog()
    } catch {
      await reloadStockAndLog()
    }
  }

  async function handleUndoEntry(entry: StockLogEntry) {
    if (!entry.transaction_id || entry.undone) return
    setLog((prev) => prev.filter((e) => e.id !== entry.id))
    try {
      await grocy.undoStockTransaction(entry.transaction_id)
      await reloadStockAndLog()
    } catch {
      await reloadStockAndLog()
    }
  }

  const header = (
    <header className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-nourish-border">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="p-2 -ml-2 text-nourish-text-dim rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary"
      >
        <BackIcon />
      </button>
      <h2 className="font-semibold text-nourish-text text-lg truncate flex-1">
        {product?.name ?? 'Produto'}
      </h2>
    </header>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-nourish-bg">
        {header}
        <Spinner />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-nourish-bg">
        {header}
        <div className="p-4">
          <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-xl text-sm">
            {error ?? 'Produto não encontrado'}
          </div>
        </div>
      </div>
    )
  }

  const buyAmount = getBuyAmountFromDesc(product.description, product.id)
  const activeLog = log.filter((e) => !e.undone)
  const consumes = activeLog.filter((e) => e.transaction_type === 'consume').slice(0, HISTORY_LIMIT)
  const purchases = activeLog.filter((e) => e.transaction_type === 'purchase').slice(0, HISTORY_LIMIT)

  return (
    <div
      className="min-h-screen bg-nourish-bg"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 140px)' }}
    >
      {header}

      {product.picture_file_name && !imgError && (
        <div className="relative w-full" style={{ paddingBottom: '75%' }}>
          <img
            src={grocy.productPictureUrl(product.picture_file_name)}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div className="px-4 pt-5 space-y-5">
        <div className="bg-nourish-surface border border-nourish-border rounded-2xl p-4">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p className="text-2xl font-bold text-nourish-primary tabular-nums">{amount}</p>
              <p className="text-xs text-nourish-text-dim mt-0.5">em stock</p>
            </div>
            {(product.calories ?? 0) > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-nourish-text tabular-nums">{product.calories}</p>
                <p className="text-xs text-nourish-text-dim mt-0.5">kcal/un</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-2xl font-bold text-nourish-text tabular-nums">+{buyAmount}</p>
              <p className="text-xs text-nourish-text-dim mt-0.5">por compra</p>
            </div>
            {stockValue !== null && (
              <div className="text-center">
                <p className="text-2xl font-bold text-nourish-primary tabular-nums">€{stockValue.toFixed(2)}</p>
                <p className="text-xs text-nourish-text-dim mt-0.5">preço/un</p>
              </div>
            )}
          </div>
        </div>

        <PriceHistoryChart points={priceHistory} />

        {consumes.length > 0 && (
          <section>
            <h3 className="font-semibold text-nourish-text mb-3">Historial de consumo</h3>
            <div className="space-y-2">
              {consumes.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 bg-nourish-surface border border-nourish-border rounded-xl overflow-hidden"
                >
                  <div className="flex-1 px-3 py-2.5">
                    <p className="text-sm text-nourish-text">{formatLogDate(entry.row_created_timestamp)}</p>
                    <p className="text-xs text-nourish-text-dim">{formatLogTime(entry.row_created_timestamp)}</p>
                  </div>
                  <span className="text-sm font-semibold text-nourish-text-dim tabular-nums px-3">
                    −{Math.abs(entry.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUndoEntry(entry)}
                    className="p-3 pr-3 text-nourish-border hover:text-red-400 transition-colors focus:outline-none"
                    aria-label="Anular registo"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {purchases.length > 0 && (
          <section>
            <h3 className="font-semibold text-nourish-text mb-3">Historial de compras</h3>
            <div className="space-y-2">
              {purchases.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 bg-nourish-surface border border-nourish-border rounded-xl overflow-hidden"
                >
                  <div className="flex-1 px-3 py-2.5">
                    <p className="text-sm text-nourish-text">{formatLogDate(entry.row_created_timestamp)}</p>
                    <p className="text-xs text-nourish-text-dim">{formatLogTime(entry.row_created_timestamp)}</p>
                  </div>
                  <div className="text-right px-3">
                    <span className="text-sm font-semibold text-nourish-primary tabular-nums block">
                      +{entry.amount}
                    </span>
                    {(entry.price ?? 0) > 0 && (
                      <span className="text-xs text-nourish-text-dim tabular-nums">
                        €{entry.price!.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUndoEntry(entry)}
                    className="p-3 pr-3 text-nourish-border hover:text-red-400 transition-colors focus:outline-none"
                    aria-label="Anular registo"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeLog.length === 0 && (
          <p className="text-nourish-text-dim text-sm text-center py-4">Sem historial ainda</p>
        )}
      </div>

      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface border-t border-nourish-border p-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConsume}
            disabled={amount <= 0}
            className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-nourish-surface-high text-nourish-text disabled:opacity-30 active:bg-nourish-surface-highest transition-colors focus:outline-none"
          >
            −1
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-nourish-primary text-nourish-on-primary active:bg-nourish-primary-dim transition-colors focus:outline-none"
          >
            +{buyAmount}
          </button>
        </div>
      </div>
    </div>
  )
}
