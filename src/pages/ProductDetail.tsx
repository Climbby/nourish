import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { Product, StockLogEntry } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { PhotoField } from '../components/PhotoField'
import { ProductMacrosSection } from '../components/ProductMacrosSection'
import {
  getMacrosFromDesc,
  upsertMacrosSection,
  type ProductMacros,
} from '../utils/productNutrition'
import {
  buildDespensaDescription,
  formatDespensaPriceLabel,
  getBuyAmountFromDesc,
  getGenericoFromDesc,
  getNomeCurtoFromDesc,
  getPriceFromDesc,
  getPriceUnitFromDesc,
  getStoreFromDesc,
  getUnitGramsFromDesc,
  shortStoreBrand,
} from '../utils/despensaAnalytics'
import {
  fetchStorePriceHistory,
  formatUnitPrice,
  type StorePriceItem,
} from '../utils/storePrices'
import { fetchVisitReceipts, type VisitReceiptLink } from '../utils/visitReceipts'
import { listDespensaProductsForMerge, mergeProducts } from '../utils/mergeProducts'
import { parseVerifiedFields } from '../utils/verification'

const PRICES_SITE = 'https://supermercados-portugal.guessitgame.me/#'
const HISTORY_LIMIT = 20
const labelClass = 'block text-sm font-medium text-nourish-text-dim mb-1.5'

function formatLogDate(ts: string): string {
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'))
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })
}

function dayKey(ts: string): string {
  return ts.slice(0, 10)
}

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path
        fillRule="evenodd"
        d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path
        fillRule="evenodd"
        d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.499.058l.346-9Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function ReceiptIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="w-4 h-4"
      aria-hidden
    >
      <path strokeLinecap="round" d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21 8 19.5 6 21V3Z" />
      <path strokeLinecap="round" d="M9 8h6M9 12h6" />
    </svg>
  )
}

function ExternalLinkIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5M15 3h6v6M10.5 13.5 21 3" />
    </svg>
  )
}

/** Latest store-price observation on/near a purchase day. */
function storePriceForPurchase(
  entry: StockLogEntry,
  storePrices: StorePriceItem[]
): StorePriceItem | null {
  if (storePrices.length === 0) return null
  const day = dayKey(entry.row_created_timestamp)
  const sameDay = storePrices.filter((p) => dayKey(p.observed_at) === day)
  if (sameDay.length > 0) {
    return [...sameDay].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0]
  }
  const purchaseMs = new Date(entry.row_created_timestamp.replace(' ', 'T')).getTime()
  let best: StorePriceItem | null = null
  let bestDist = Infinity
  for (const p of storePrices) {
    const dist = Math.abs(new Date(p.observed_at).getTime() - purchaseMs)
    if (dist < bestDist) {
      bestDist = dist
      best = p
    }
  }
  // Only use near matches (within 3 days)
  return bestDist <= 3 * 24 * 60 * 60 * 1000 ? best : null
}

/** Match visit receipt even when purchase day ≠ receipt purchased_date (timezone / lag). */
function findReceiptForPurchase(
  entry: StockLogEntry,
  receipts: VisitReceiptLink[],
  storePrice: StorePriceItem | null
): VisitReceiptLink | null {
  if (receipts.length === 0) return null
  const days = new Set<string>()
  const purchaseMs = new Date(entry.row_created_timestamp.replace(' ', 'T')).getTime()
  days.add(dayKey(entry.row_created_timestamp))
  days.add(dayKey(new Date(purchaseMs - 86400000).toISOString()))
  days.add(dayKey(new Date(purchaseMs + 86400000).toISOString()))
  if (storePrice) days.add(dayKey(storePrice.observed_at))

  for (const r of receipts) {
    const purchased = r.purchased_date?.slice(0, 10)
    const visitDay = r.visit_entered_at?.slice(0, 10)
    if ((purchased && days.has(purchased)) || (visitDay && days.has(visitDay))) return r
  }
  return null
}

function pricesSiteProductUrl(opts: {
  name: string
  productId: number
  storeId?: string
}): string {
  const params = new URLSearchParams()
  params.set('name', opts.name)
  params.set('id', String(opts.productId))
  if (opts.storeId) params.set('store', opts.storeId)
  return `${PRICES_SITE}/product?${params.toString()}`
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const numId = parseInt(id!, 10)

  const [product, setProduct] = useState<Product | null>(null)
  const [log, setLog] = useState<StockLogEntry[]>([])
  const [storePrices, setStorePrices] = useState<StorePriceItem[]>([])
  const [receipts, setReceipts] = useState<VisitReceiptLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [stockSaving, setStockSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [generico, setGenerico] = useState('')
  const [nomeCurto, setNomeCurto] = useState('')
  const [unitGrams, setUnitGrams] = useState('')
  const [metaSaving, setMetaSaving] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeTargets, setMergeTargets] = useState<Product[]>([])
  const [mergeIntoId, setMergeIntoId] = useState<number | ''>('')
  const [mergeBusy, setMergeBusy] = useState(false)
  const [mergeMsg, setMergeMsg] = useState<string | null>(null)
  const [macrosSaving, setMacrosSaving] = useState(false)

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
    setLoading(true)
    setError(null)
    Promise.all([
      grocy.getProduct(numId),
      grocy.getStockLog(numId),
      fetchVisitReceipts(),
    ])
      .then(async ([prod, logEntries, visitReceipts]) => {
        const prices = await fetchStorePriceHistory({
          product_id: numId,
          product_name: prod.name,
        })
        setProduct(prod)
        setGenerico(getGenericoFromDesc(prod.description) ?? '')
        setNomeCurto(getNomeCurtoFromDesc(prod.description) ?? '')
        const ug = getUnitGramsFromDesc(prod.description)
        setUnitGrams(ug != null ? String(ug) : '')
        if (prod.picture_file_name) {
          setPhotoPreview(grocy.productPictureUrl(prod.picture_file_name))
        }
        setLog(sortLog(logEntries))
        setStorePrices(prices ?? [])
        setReceipts(visitReceipts)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [numId])

  async function reloadLog() {
    setLog(sortLog(await grocy.getStockLog(numId)))
  }

  async function handlePhotoChange(file: File | null, url: string | null) {
    setPhotoPreview(url)
    if (!file || !product) return
    try {
      const picture_file_name = await grocy.uploadProductPicture(file, numId)
      await grocy.updateProduct(numId, { picture_file_name })
      setProduct({ ...product, picture_file_name })
    } catch {
      /* keep preview */
    }
  }

  async function handleSaveCookingMeta() {
    if (!product) return
    setMetaSaving(true)
    try {
      const buyAmount = getBuyAmountFromDesc(product.description, product.id)
      const price = getPriceFromDesc(product.description)
      const description = buildDespensaDescription(buyAmount, price, {
        verified: parseVerifiedFields(product.description),
        existingDescription: product.description,
        generico: generico || null,
        nomeCurto: nomeCurto || null,
        unitGrams: unitGrams || null,
      })
      await grocy.updateProduct(numId, { description })
      setProduct({ ...product, description })
    } catch {
      /* keep local */
    } finally {
      setMetaSaving(false)
    }
  }

  async function handleSaveMacros(next: ProductMacros | null) {
    if (!product) return
    setMacrosSaving(true)
    try {
      const description = upsertMacrosSection(product.description, next)
      await grocy.updateProduct(numId, { description })
      setProduct({ ...product, description })
    } catch {
      /* keep local */
    } finally {
      setMacrosSaving(false)
    }
  }

  async function openMerge() {
    setMergeMsg(null)
    setMergeOpen(true)
    setMergeIntoId('')
    try {
      setMergeTargets(await listDespensaProductsForMerge(numId))
    } catch {
      setMergeTargets([])
    }
  }

  async function handleMerge() {
    if (!mergeIntoId || typeof mergeIntoId !== 'number') return
    setMergeBusy(true)
    setMergeMsg(null)
    try {
      const result = await mergeProducts(mergeIntoId, numId)
      const warn =
        result.recipesWarned > 0
          ? ` (${result.recipesWarned} receita(s) podem precisar de revisão)`
          : ''
      navigate(`/product/${result.canonicalId}`, {
        replace: true,
        state: {
          feedback: {
            kind: 'success',
            message: `Fundido · stock ${result.stockTransferred}${warn}`,
          },
        },
      })
    } catch (e) {
      setMergeMsg(e instanceof Error ? e.message : 'Falha ao fundir')
    } finally {
      setMergeBusy(false)
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
      await reloadLog()
    } catch {
      await reloadLog()
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

  const catalogPrice = getPriceFromDesc(product.description)
  const storeFromDesc = getStoreFromDesc(product.description)

  const activeLog = log.filter((e) => !e.undone)
  const purchases = activeLog.filter((e) => e.transaction_type === 'purchase').slice(0, HISTORY_LIMIT)

  const latestByStore = (() => {
    const latest = new Map<string, StorePriceItem>()
    for (const row of [...storePrices].sort((a, b) => a.observed_at.localeCompare(b.observed_at))) {
      latest.set(row.store_id, row)
    }
    return [...latest.values()].sort((a, b) => b.observed_at.localeCompare(a.observed_at))
  })()

  return (
    <div
      className="min-h-screen bg-nourish-bg"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}
    >
      {header}

      <div className="px-4 pt-5 space-y-5">
        <PhotoField preview={photoPreview} onChange={handlePhotoChange} labelClass={labelClass} />

        <ProductMacrosSection
          macros={getMacrosFromDesc(product.description)}
          onSave={(next) => void handleSaveMacros(next)}
          saving={macrosSaving}
        />

        <section className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-3">
          <div>
            <label className={labelClass}>
              Nome genérico <span className="text-nourish-border font-normal">(família)</span>
            </label>
            <input
              type="text"
              value={generico}
              onChange={(e) => setGenerico(e.target.value)}
              onBlur={() => void handleSaveCookingMeta()}
              placeholder="ex: Cogumelos"
              className="w-full px-4 py-3 bg-nourish-surface-high border border-nourish-border rounded-xl text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            />
            <p className="text-xs text-nourish-text-dim mt-1">
              Agrupa variantes na Despensa (vários packs, um nome)
            </p>
          </div>
          <div>
            <label className={labelClass}>
              Nome curto <span className="text-nourish-border font-normal">(cozinhar)</span>
            </label>
            <input
              type="text"
              value={nomeCurto}
              onChange={(e) => setNomeCurto(e.target.value)}
              onBlur={() => void handleSaveCookingMeta()}
              placeholder="ex: Atum, Ovo…"
              className="w-full px-4 py-3 bg-nourish-surface-high border border-nourish-border rounded-xl text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            />
          </div>
          <div>
            <label className={labelClass}>
              Gramas por unidade <span className="text-nourish-border font-normal">(opcional)</span>
            </label>
            <input
              type="number"
              value={unitGrams}
              onChange={(e) => setUnitGrams(e.target.value)}
              onBlur={() => void handleSaveCookingMeta()}
              placeholder="ex: 120 para lata, ~55 para ovo"
              min="0"
              step="1"
              className="w-full px-4 py-3 bg-nourish-surface-high border border-nourish-border rounded-xl text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            />
            {metaSaving && (
              <p className="text-xs text-nourish-text-dim mt-1">A guardar…</p>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              navigate(
                `/add-product?generico=${encodeURIComponent(
                  generico.trim() || getGenericoFromDesc(product.description) || product.name
                )}`
              )
            }
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-nourish-border text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          >
            Adicionar variante…
          </button>
          {!mergeOpen ? (
            <button
              type="button"
              onClick={() => void openMerge()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border border-nourish-border text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            >
              Fundir com outro produto…
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-nourish-text-dim leading-snug">
                Este produto (duplicado) funde-se no canónico escolhido: stock, aliases e ingredientes
                de receitas passam para lá; este fica inactivo.
              </p>
              <select
                value={mergeIntoId === '' ? '' : String(mergeIntoId)}
                onChange={(e) =>
                  setMergeIntoId(e.target.value ? parseInt(e.target.value, 10) : '')
                }
                className="w-full px-3 py-2 bg-nourish-surface-high border border-nourish-border rounded-lg text-nourish-text text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              >
                <option value="">— Escolher canónico —</option>
                {mergeTargets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {getGenericoFromDesc(p.description)
                      ? ` · ${getGenericoFromDesc(p.description)}`
                      : ''}
                  </option>
                ))}
              </select>
              {mergeMsg && <p className="text-xs text-red-400">{mergeMsg}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMergeOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-surface-high text-nourish-text"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={mergeBusy || mergeIntoId === ''}
                  onClick={() => void handleMerge()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-40"
                >
                  {mergeBusy ? 'A fundir…' : 'Fundir'}
                </button>
              </div>
            </div>
          )}
        </section>

        {latestByStore.length > 0 && (
          <section className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-nourish-text text-sm">Preço por loja</h3>
              <a
                href={pricesSiteProductUrl({ name: product.name, productId: numId })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-nourish-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded"
              >
                Site de preços
                <ExternalLinkIcon className="w-3 h-3" />
              </a>
            </div>
            <ul className="space-y-1.5">
              {latestByStore.map((row) => (
                <li
                  key={row.store_id}
                  className="flex items-center justify-between gap-2 text-sm px-1 py-1"
                >
                  <span className="text-nourish-text truncate min-w-0">
                    {row.store_label}
                    <span className="text-nourish-text-dim tabular-nums">
                      {' '}
                      · {formatLogDate(row.observed_at)}
                    </span>
                  </span>
                  <span className="tabular-nums text-nourish-primary font-semibold shrink-0">
                    {formatUnitPrice(row)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {purchases.length > 0 && (
          <section>
            <h3 className="font-semibold text-nourish-text mb-3">Historial de compras</h3>
            <div className="space-y-2">
              {purchases.map((entry) => {
                const matched = storePriceForPurchase(entry, storePrices)
                const storeLabel = matched?.store_label ?? storeFromDesc ?? null
                const storeBrand = storeLabel ? shortStoreBrand(storeLabel) : null
                const unitLabel = matched
                  ? formatUnitPrice(matched)
                  : catalogPrice != null && getPriceUnitFromDesc(product.description) === 'kg'
                    ? formatDespensaPriceLabel(catalogPrice, product.description)
                    : catalogPrice != null
                      ? `€${catalogPrice.toFixed(2)}`
                      : null
                const paid = (entry.price ?? 0) > 0 ? entry.price! : null
                const receipt = findReceiptForPurchase(entry, receipts, matched)

                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-1 bg-nourish-surface border border-nourish-border rounded-xl overflow-hidden"
                  >
                    {receipt ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/receipt?visit=${encodeURIComponent(receipt.visit_entered_at)}`)
                        }
                        className="p-3 text-nourish-primary focus:outline-none focus:ring-2 focus:ring-inset focus:ring-nourish-primary shrink-0"
                        aria-label="Ver talão / visita associada"
                        title="Talão / visita associada"
                      >
                        <ReceiptIcon />
                      </button>
                    ) : (
                      <span
                        className="p-3 text-nourish-border shrink-0"
                        title="Sem talão associado a esta compra"
                        aria-hidden
                      >
                        <ReceiptIcon />
                      </span>
                    )}
                    <div className="flex-1 min-w-0 py-2.5 pr-2">
                      <p className="text-sm text-nourish-text">
                        {formatLogDate(entry.row_created_timestamp)}
                      </p>
                      {(storeBrand || unitLabel) && (
                        <p className="text-xs text-nourish-text-dim truncate mt-0.5">
                          {storeBrand}
                          {storeBrand && unitLabel && ' · '}
                          {unitLabel && (
                            <span className="text-nourish-primary font-semibold tabular-nums">
                              {unitLabel}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    {paid != null && (
                      <span className="text-sm font-semibold text-nourish-primary tabular-nums shrink-0 px-1">
                        €{paid.toFixed(2)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUndoEntry(entry)}
                      className="p-3 pr-3 text-nourish-border hover:text-red-400 transition-colors focus:outline-none"
                      aria-label="Anular registo"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {purchases.length === 0 && latestByStore.length === 0 && (
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
    </div>
  )
}
