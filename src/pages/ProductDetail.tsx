import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { PriceHistoryPoint, Product, StockLogEntry } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { PhotoField } from '../components/PhotoField'
import { PriceHistoryChart } from '../components/PriceHistoryChart'
import { NumericInput } from '../components/NumericInput'
import { VerifiedBadge, VerifyCheckbox } from '../components/VerifiedBadge'
import {
  buildDespensaDescription,
  getBuyAmountFromDesc,
  getDespensaUnitPrice,
  getPriceFromDesc,
  purchaseTotalPrice,
} from '../utils/despensaAnalytics'
import { isVerified, parseVerifiedFields, type VerifiedField } from '../utils/verification'

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

const labelClass = 'block text-sm font-medium text-nourish-text-dim mb-1.5'

export function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const numId = parseInt(id!, 10)

  const [product, setProduct] = useState<Product | null>(null)
  const [amount, setAmount] = useState(0)
  const [log, setLog] = useState<StockLogEntry[]>([])
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([])
  const [stockValueTotal, setStockValueTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState(0)
  const [editBuyAmount, setEditBuyAmount] = useState('1')
  const [editUnitPrice, setEditUnitPrice] = useState('')
  const [editCalories, setEditCalories] = useState('')
  const [verifyPrice, setVerifyPrice] = useState(false)
  const [verifyCalories, setVerifyCalories] = useState(false)
  const [stockSaving, setStockSaving] = useState(false)
  const [metaSaving, setMetaSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

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
        setStockValueTotal(stockSummary.value)
        setEditBuyAmount(String(getBuyAmountFromDesc(prod.description, prod.id)))
        const catalogPrice = getPriceFromDesc(prod.description)
        setEditUnitPrice(catalogPrice != null ? catalogPrice.toFixed(2) : '')
        setEditCalories(prod.calories != null && prod.calories > 0 ? String(prod.calories) : '')
        const verified = parseVerifiedFields(prod.description)
        setVerifyPrice(verified.has('preco'))
        setVerifyCalories(verified.has('calorias'))
        if (prod.picture_file_name) {
          setPhotoPreview(grocy.productPictureUrl(prod.picture_file_name))
        }
        setLog(sortLog(logEntries))
        setPriceHistory(history)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [numId])

  useEffect(() => {
    setEditAmount(amount)
  }, [amount])

  async function reloadStockAndLog() {
    const [stockSummary, newLog, history] = await Promise.all([
      grocy.getProductStockAmount(numId),
      grocy.getStockLog(numId),
      grocy.getPriceHistory(numId).catch(() => [] as PriceHistoryPoint[]),
    ])
    setAmount(stockSummary.amount)
    setStockValueTotal(stockSummary.value)
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
    const unitPrice = getDespensaUnitPrice(amount, stockValueTotal, product?.description ?? null)
    const totalPrice = purchaseTotalPrice(unitPrice, ba)
    setAmount((a) => a + ba)
    try {
      await grocy.addStock(numId, ba, totalPrice != null ? { price: totalPrice } : undefined)
      await reloadStockAndLog()
    } catch {
      await reloadStockAndLog()
    }
  }

  function buildVerifiedSet(): Set<VerifiedField> {
    const v = new Set<VerifiedField>()
    if (verifyPrice && editUnitPrice.trim() && parseFloat(editUnitPrice) > 0) v.add('preco')
    if (verifyCalories && editCalories.trim() && parseFloat(editCalories) > 0) v.add('calorias')
    return v
  }

  async function handleSaveMeta() {
    if (!product) return
    setMetaSaving(true)
    try {
      const description = buildDespensaDescription(editBuyAmount || '1', editUnitPrice, {
        verified: buildVerifiedSet(),
      })
      const calories = editCalories.trim() ? parseFloat(editCalories) : null
      const updates: Record<string, unknown> = {
        description,
        calories: calories != null && !isNaN(calories) ? calories : null,
      }
      if (photoFile) {
        updates.picture_file_name = await grocy.uploadProductPicture(photoFile, numId)
      }
      await grocy.updateProduct(numId, updates)
      setProduct({
        ...product,
        description,
        calories: calories != null && !isNaN(calories) ? calories : null,
        picture_file_name: (updates.picture_file_name as string | undefined) ?? product.picture_file_name,
      })
      setPhotoFile(null)
    } catch {
      /* keep form values */
    } finally {
      setMetaSaving(false)
    }
  }

  async function handleSaveStock() {
    setStockSaving(true)
    try {
      await grocy.setStockAmount(numId, editAmount)
      await reloadStockAndLog()
    } catch {
      await reloadStockAndLog()
    } finally {
      setStockSaving(false)
    }
  }

  async function handleRemoveProduct() {
    setStockSaving(true)
    try {
      await grocy.deleteProduct(numId)
      navigate('/meals?filter=despensa', { replace: true })
    } catch {
      setConfirmRemove(false)
    } finally {
      setStockSaving(false)
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
  const unitPrice = getDespensaUnitPrice(amount, stockValueTotal, product.description)
  const priceVerified = isVerified(product.description, 'preco')
  const caloriesVerified = isVerified(product.description, 'calorias')
  const activeLog = log.filter((e) => !e.undone)
  const consumes = activeLog.filter((e) => e.transaction_type === 'consume').slice(0, HISTORY_LIMIT)
  const purchases = activeLog.filter((e) => e.transaction_type === 'purchase').slice(0, HISTORY_LIMIT)

  return (
    <div
      className="min-h-screen bg-nourish-bg"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 200px)' }}
    >
      {header}

      <div className="px-4 pt-5 space-y-5">
        <PhotoField
          preview={photoPreview}
          onChange={(file, url) => {
            setPhotoFile(file)
            setPhotoPreview(url)
          }}
          labelClass={labelClass}
        />
        <div className="bg-nourish-surface border border-nourish-border rounded-2xl p-4">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p className="text-2xl font-bold text-nourish-primary tabular-nums">{amount}</p>
              <p className="text-xs text-nourish-text-dim mt-0.5">em stock</p>
            </div>
            {(product.calories ?? 0) > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-nourish-text tabular-nums flex items-center justify-center gap-1">
                  {product.calories}
                  <VerifiedBadge verified={caloriesVerified} />
                </p>
                <p className="text-xs text-nourish-text-dim mt-0.5">kcal/un</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-2xl font-bold text-nourish-text tabular-nums">+{buyAmount}</p>
              <p className="text-xs text-nourish-text-dim mt-0.5">por compra</p>
            </div>
            {unitPrice !== null && (
              <div className="text-center">
                <p className="text-2xl font-bold text-nourish-primary tabular-nums flex items-center justify-center gap-1">
                  €{unitPrice.toFixed(2)}
                  <VerifiedBadge verified={priceVerified} />
                </p>
                <p className="text-xs text-nourish-text-dim mt-0.5">preço/un</p>
              </div>
            )}
          </div>
        </div>

        <section className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-nourish-text text-sm">Compra habitual</h3>
          <p className="text-xs text-nourish-text-dim">
            Quantidade e preço por unidade usados no botão + e na lista da despensa. Marca como
            verificado quando confirmares os valores (ex. no rótulo ou talão).
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-nourish-text-dim block mb-1">Quantidade</label>
              <NumericInput
                value={parseInt(editBuyAmount, 10) || 1}
                onChange={(n) => setEditBuyAmount(String(Math.max(1, n)))}
                integer
                min={1}
                className="w-full text-center font-semibold tabular-nums text-nourish-text bg-nourish-surface-high border border-nourish-border rounded-xl py-2.5 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                aria-label="Quantidade por compra"
              />
            </div>
            <div>
              <label className="text-xs text-nourish-text-dim block mb-1">Preço/un (€)</label>
              <input
                type="number"
                value={editUnitPrice}
                onChange={(e) => {
                  setEditUnitPrice(e.target.value)
                  setVerifyPrice(false)
                }}
                placeholder="—"
                min="0"
                step="0.01"
                className="w-full text-center font-semibold tabular-nums text-nourish-text bg-nourish-surface-high border border-nourish-border rounded-xl py-2.5 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                aria-label="Preço por unidade"
              />
              <div className="mt-1.5">
                <VerifyCheckbox
                  id="verify-price"
                  checked={verifyPrice}
                  onChange={setVerifyPrice}
                  label="Preço verificado"
                  disabled={!editUnitPrice.trim() || parseFloat(editUnitPrice) <= 0}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-nourish-text-dim block mb-1">Calorias (por unidade)</label>
            <input
              type="number"
              value={editCalories}
              onChange={(e) => {
                setEditCalories(e.target.value)
                setVerifyCalories(false)
              }}
              placeholder="—"
              min="0"
              className="w-full text-center font-semibold tabular-nums text-nourish-text bg-nourish-surface-high border border-nourish-border rounded-xl py-2.5 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              aria-label="Calorias por unidade"
            />
            <div className="mt-1.5">
              <VerifyCheckbox
                id="verify-calories"
                checked={verifyCalories}
                onChange={setVerifyCalories}
                label="Calorias verificadas"
                disabled={!editCalories.trim() || parseFloat(editCalories) <= 0}
              />
            </div>
          </div>
          <button
            type="button"
            disabled={metaSaving}
            onClick={handleSaveMeta}
            className="w-full py-2.5 rounded-xl font-semibold text-sm bg-nourish-surface-high text-nourish-text disabled:opacity-40 active:bg-nourish-surface-highest"
          >
            {metaSaving ? '…' : 'Guardar'}
          </button>
        </section>

        <section className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-nourish-text text-sm">Corrigir stock</h3>
          <p className="text-xs text-nourish-text-dim">
            Define a quantidade real em casa. Usa isto se o valor estiver errado (ex.: diz 8 mas tens 2).
          </p>
          <div className="flex items-center gap-2">
            <NumericInput
              value={editAmount}
              onChange={setEditAmount}
              integer
              min={0}
              className="flex-1 text-center text-xl font-bold text-nourish-primary tabular-nums bg-nourish-surface-high border border-nourish-border rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              aria-label="Quantidade em stock"
            />
            <button
              type="button"
              disabled={stockSaving || editAmount === amount}
              onClick={handleSaveStock}
              className="px-4 py-3 rounded-xl font-semibold text-sm bg-nourish-primary text-nourish-on-primary disabled:opacity-40 active:bg-nourish-primary-dim"
            >
              {stockSaving ? '…' : 'Guardar'}
            </button>
          </div>
        </section>

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

        <section className="pt-2 pb-4">
          {!confirmRemove ? (
            <button
              type="button"
              disabled={stockSaving}
              onClick={() => setConfirmRemove(true)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-red-400 border border-red-800/50 bg-red-900/10 active:bg-red-900/20"
            >
              Remover da despensa
            </button>
          ) : (
            <div className="space-y-2 p-3 rounded-xl bg-red-900/20 border border-red-800/50">
              <p className="text-sm text-red-300 text-center">
                O produto é apagado permanentemente do Grocy. Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={stockSaving}
                  onClick={() => setConfirmRemove(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-surface-high text-nourish-text"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={stockSaving}
                  onClick={handleRemoveProduct}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white disabled:opacity-40"
                >
                  {stockSaving ? '…' : 'Remover'}
                </button>
              </div>
            </div>
          )}
        </section>
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
            Consumir
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-nourish-primary text-nourish-on-primary active:bg-nourish-primary-dim transition-colors focus:outline-none"
          >
            Comprar
          </button>
        </div>
      </div>
    </div>
  )
}
