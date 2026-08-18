import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { Product, StockLogEntry } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { PhotoField } from '../components/PhotoField'
import { ProductMacrosSection } from '../components/ProductMacrosSection'
import { ProductVariantCarousel } from '../components/ProductVariantCarousel'
import { BottomNav } from '../components/BottomNav'
import {
  getMacrosFromDesc,
  upsertMacrosSection,
  type ProductMacros,
} from '../utils/productNutrition'
import { insaLookupNames } from '../utils/insaNutrition'
import {
  buildDespensaDescription,
  familyKey,
  formatDespensaPriceLabel,
  getBuyAmountFromDesc,
  getGenericoFromDesc,
  getPriceFromDesc,
  getPriceUnitFromDesc,
  getStoreFromDesc,
  getUnitGramsFromDesc,
  inferUnitGramsFromName,
  shortStoreBrand,
} from '../utils/despensaAnalytics'
import {
  fetchStorePriceHistory,
  formatUnitPrice,
  type StorePriceItem,
} from '../utils/storePrices'
import { fetchVisitReceipts, type VisitReceiptLink } from '../utils/visitReceipts'
import { parseVerifiedFields } from '../utils/verification'
import { formatPtDate } from '../utils/formatPtDate'
import {
  aggregateFamilyPurchases,
  findGenericoSiblings,
  mergeStorePriceItems,
  nextSiblingId,
  toVariantSummaries,
  type FamilyVariantSummary,
} from '../utils/productFamily'
import { useGenericoFavorites } from '../hooks/useGenericoFavorites'

const PRICES_SITE = 'https://supermercados-portugal.guessitgame.me/#'
const HISTORY_LIMIT = 20
const labelClass = 'block text-sm font-medium text-nourish-text-dim mb-1.5'

function formatLogDate(ts: string): string {
  return formatPtDate(ts)
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

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
      <path
        fillRule="evenodd"
        d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z"
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

function sortLog(entries: StockLogEntry[]): StockLogEntry[] {
  return [...entries].sort(
    (a, b) =>
      new Date(b.row_created_timestamp.replace(' ', 'T')).getTime() -
      new Date(a.row_created_timestamp.replace(' ', 'T')).getTime()
  )
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const numId = parseInt(id!, 10)
  const { favorites, setFavorite } = useGenericoFavorites()

  const [product, setProduct] = useState<Product | null>(null)
  const [siblings, setSiblings] = useState<Product[]>([])
  const [variantSummaries, setVariantSummaries] = useState<FamilyVariantSummary[]>([])
  const [familyLog, setFamilyLog] = useState<StockLogEntry[]>([])
  const [storePrices, setStorePrices] = useState<StorePriceItem[]>([])
  const [receipts, setReceipts] = useState<VisitReceiptLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [stockSaving, setStockSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [generico, setGenerico] = useState('')
  const [unitGrams, setUnitGrams] = useState('')
  const [buyAmount, setBuyAmount] = useState('1')
  const [metaSaving, setMetaSaving] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [macrosSaving, setMacrosSaving] = useState(false)

  /** Avoid reloading family history when swiping within the same Generico. */
  const familyCacheKey = useRef<string | null>(null)

  function applyProduct(prod: Product) {
    setProduct(prod)
    setGenerico(getGenericoFromDesc(prod.description) ?? '')
    const stored = getUnitGramsFromDesc(prod.description)
    const inferred = inferUnitGramsFromName(prod.name)
    setUnitGrams((stored ?? inferred)?.toString() ?? '')
    setBuyAmount(String(getBuyAmountFromDesc(prod.description, prod.id)))
    setPhotoPreview(prod.picture_file_name ? grocy.productPictureUrl(prod.picture_file_name) : null)
  }

  function goToVariant(nextId: number) {
    if (nextId === numId) return
    navigate(`/product/${nextId}`, { replace: true })
  }

  useEffect(() => {
    if (isNaN(numId)) {
      setError('ID inválido')
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setError(null)

      const cachedSibling = siblings.find((s) => s.id === numId)
      const sameFamily =
        cachedSibling != null &&
        siblings.length > 1 &&
        familyCacheKey.current != null

      if (sameFamily && cachedSibling) {
        applyProduct(cachedSibling)
        setLoading(false)
        // Refresh this SKU in background so edits elsewhere stay current
        void grocy.getProduct(numId).then((prod) => {
          if (cancelled) return
          applyProduct(prod)
          setSiblings((prev) => prev.map((s) => (s.id === prod.id ? prod : s)))
          setVariantSummaries((prev) =>
            prev.map((v) =>
              v.id === prod.id
                ? {
                    id: prod.id,
                    name: prod.name,
                    picture_file_name: prod.picture_file_name,
                    price: getPriceFromDesc(prod.description),
                    description: prod.description,
                  }
                : v
            )
          )
        })
        return
      }

      setLoading(true)
      try {
        const [prod, allProducts, visitReceipts] = await Promise.all([
          grocy.getProduct(numId),
          grocy.getProducts(),
          fetchVisitReceipts(),
        ])
        if (cancelled) return

        const family = findGenericoSiblings(allProducts, prod)
        const multi = family.length > 1
        const cacheKey = multi
          ? (getGenericoFromDesc(prod.description) ?? '').toLowerCase()
          : `solo:${prod.id}`

        applyProduct(prod)
        setSiblings(family)
        setVariantSummaries(toVariantSummaries(family))
        setReceipts(visitReceipts)
        familyCacheKey.current = cacheKey

        const memberIds = family.map((p) => p.id)
        const [logs, priceLists] = await Promise.all([
          Promise.all(memberIds.map((pid) => grocy.getStockLog(pid))),
          Promise.all(
            family.map((p) =>
              fetchStorePriceHistory({ product_id: p.id, product_name: p.name })
            )
          ),
        ])
        if (cancelled) return

        setFamilyLog(sortLog(logs.flat()))
        setStorePrices(mergeStorePriceItems(priceLists.map((p) => p ?? [])))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
    // siblings intentionally omitted — cache hit uses ref + current siblings snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numId])

  async function reloadFamilyLog() {
    const ids = (siblings.length > 0 ? siblings : product ? [product] : []).map((p) => p.id)
    if (ids.length === 0) return
    const logs = await Promise.all(ids.map((pid) => grocy.getStockLog(pid)))
    setFamilyLog(sortLog(logs.flat()))
  }

  async function handlePhotoChange(file: File, url: string) {
    setPhotoPreview(url)
    if (!file || !product) return
    try {
      const picture_file_name = await grocy.uploadProductPicture(file, numId)
      await grocy.updateProduct(numId, { picture_file_name })
      const updated = { ...product, picture_file_name }
      setProduct(updated)
      setSiblings((prev) => prev.map((s) => (s.id === numId ? updated : s)))
      setVariantSummaries((prev) =>
        prev.map((v) => (v.id === numId ? { ...v, picture_file_name } : v))
      )
    } catch {
      /* keep preview */
    }
  }

  async function handleSaveCookingMeta(overrides?: { unitGrams?: string; buyAmount?: string }) {
    if (!product) return
    setMetaSaving(true)
    try {
      const parsedBuy = parseInt(overrides?.buyAmount ?? buyAmount, 10)
      const nextBuy = Number.isFinite(parsedBuy) && parsedBuy > 0 ? parsedBuy : 1
      const price = getPriceFromDesc(product.description)
      const nextGrams = overrides?.unitGrams ?? unitGrams
      const description = buildDespensaDescription(nextBuy, price, {
        verified: parseVerifiedFields(product.description),
        existingDescription: product.description,
        generico: generico || null,
        unitGrams: nextGrams || null,
      })
      await grocy.updateProduct(numId, { description })
      const updated = { ...product, description }
      setProduct(updated)
      setSiblings((prev) => prev.map((s) => (s.id === numId ? updated : s)))
      if (overrides?.unitGrams != null) setUnitGrams(overrides.unitGrams)
      setBuyAmount(String(nextBuy))
    } catch {
      /* keep local */
    } finally {
      setMetaSaving(false)
    }
  }

  useEffect(() => {
    if (loading || !product) return
    if (getUnitGramsFromDesc(product.description) != null) return
    const inferred = inferUnitGramsFromName(product.name)
    if (inferred == null) return
    void handleSaveCookingMeta({ unitGrams: String(inferred) })
    // Persist pack weight decoded from the SKU name once per product open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, product?.id])

  async function handleSaveMacros(next: ProductMacros | null) {
    if (!product) return
    setMacrosSaving(true)
    try {
      const description = upsertMacrosSection(product.description, next)
      await grocy.updateProduct(numId, { description })
      const updated = { ...product, description }
      setProduct(updated)
      setSiblings((prev) => prev.map((s) => (s.id === numId ? updated : s)))
    } catch {
      /* keep local */
    } finally {
      setMacrosSaving(false)
    }
  }

  async function handleRemoveProduct() {
    setStockSaving(true)
    try {
      await grocy.deleteProduct(numId)
      const siblingId = nextSiblingId(siblings, numId)
      familyCacheKey.current = null
      if (siblingId != null) {
        navigate(`/product/${siblingId}`, { replace: true })
      } else {
        navigate('/meals?filter=despensa', { replace: true })
      }
    } catch {
      setConfirmRemove(false)
    } finally {
      setStockSaving(false)
    }
  }

  async function handleUndoEntry(entry: StockLogEntry) {
    if (!entry.transaction_id || entry.undone) return
    setFamilyLog((prev) => prev.filter((e) => e.id !== entry.id))
    try {
      await grocy.undoStockTransaction(entry.transaction_id)
      await reloadFamilyLog()
    } catch {
      await reloadFamilyLog()
    }
  }

  const familyTitle =
    generico.trim() ||
    (product ? getGenericoFromDesc(product.description) : null) ||
    product?.name ||
    'Produto'
  const multiVariant = variantSummaries.length > 1

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
        {multiVariant ? familyTitle : (product?.name ?? 'Produto')}
      </h2>
      {multiVariant && (
        <span className="text-[11px] text-nourish-text-dim tabular-nums shrink-0">
          {variantSummaries.findIndex((v) => v.id === numId) + 1}/{variantSummaries.length}
        </span>
      )}
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
  const suggestedUnitGrams = inferUnitGramsFromName(product.name)
  const purchases = aggregateFamilyPurchases(familyLog, HISTORY_LIMIT)
  const nameById = new Map(siblings.map((s) => [s.id, s.name]))

  const latestByStore = (() => {
    const latest = new Map<string, StorePriceItem>()
    for (const row of [...storePrices].sort((a, b) => a.observed_at.localeCompare(b.observed_at))) {
      latest.set(row.store_id, row)
    }
    return [...latest.values()].sort((a, b) => b.observed_at.localeCompare(a.observed_at))
  })()

  const variantHref = `/add-product?generico=${encodeURIComponent(
    generico.trim() || getGenericoFromDesc(product.description) || product.name
  )}`
  const displayName = generico.trim() || product.name

  const nameOverlay = (
    <div className="bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pt-12 pb-3">
      {editingName ? (
        <input
          autoFocus
          value={generico}
          onChange={(e) => setGenerico(e.target.value)}
          onBlur={() => {
            setEditingName(false)
            void handleSaveCookingMeta()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          placeholder={product.name}
          className="pointer-events-auto w-full bg-transparent text-white font-semibold text-lg leading-tight placeholder-white/50 focus:outline-none"
        />
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-lg leading-tight drop-shadow-sm">
              {displayName}
            </p>
            {multiVariant && (
              <p className="text-white/85 text-xs mt-1 truncate">
                {product.name}
                {catalogPrice != null && (
                  <>
                    {' '}
                    ·{' '}
                    <span className="tabular-nums font-semibold">
                      {formatDespensaPriceLabel(catalogPrice, product.description)}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!generico.trim()) setGenerico(product.name)
              setEditingName(true)
            }}
            className="pointer-events-auto p-2 -mr-2 -mb-1 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-white/80"
            aria-label="Editar nome"
          >
            <PencilIcon />
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div
      className="min-h-screen bg-nourish-bg"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 140px)' }}
    >
      {header}

      <div className="px-4 pt-5 space-y-5">
        {multiVariant ? (
          <ProductVariantCarousel
            variants={variantSummaries}
            activeId={numId}
            activePreview={photoPreview}
            onActiveChange={goToVariant}
            onPhotoChange={handlePhotoChange}
            overlay={nameOverlay}
            favoriteId={favorites[familyKey(product.name, product.description)]}
            onToggleFavorite={(variantId) =>
              setFavorite(familyKey(product.name, product.description), variantId)
            }
          />
        ) : (
          <PhotoField
            preview={photoPreview}
            onChange={handlePhotoChange}
            labelClass={labelClass}
            hideLabel
            overlay={nameOverlay}
          />
        )}

        {!photoPreview && !multiVariant && (
          <section className="bg-nourish-surface border border-nourish-border rounded-2xl p-4">
            <label className={labelClass}>Nome</label>
            <input
              type="text"
              value={generico}
              onChange={(e) => setGenerico(e.target.value)}
              onBlur={() => void handleSaveCookingMeta()}
              placeholder="ex: Cogumelos"
              className="w-full px-4 py-3 bg-nourish-surface-high border border-nourish-border rounded-xl text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            />
            {metaSaving && <p className="text-xs text-nourish-text-dim mt-1">A guardar…</p>}
          </section>
        )}

        {latestByStore.length > 0 && (
          <section className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-nourish-text text-sm">
                {multiVariant ? 'Preço por loja (família)' : 'Preço por loja'}
              </h3>
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

        <section className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-4">
          <div>
            <label className={labelClass}>
              Quantidade que compras de cada vez
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              onBlur={() => void handleSaveCookingMeta()}
              min="1"
              step="1"
              className="w-full px-4 py-3 bg-nourish-surface-high border border-nourish-border rounded-xl text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            />
            <p className="text-xs text-nourish-text-dim mt-1">
              Unidades dentro da embalagem. Ex: 6 numa caixa de ovos — na refeição, 5 un são 5 ovos, não 5 caixas.
            </p>
          </div>
          <div>
            <label className={labelClass}>
              Gramas por unidade <span className="text-nourish-border font-normal">(opcional)</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={unitGrams}
              onChange={(e) => setUnitGrams(e.target.value)}
              onBlur={() => void handleSaveCookingMeta()}
              placeholder={suggestedUnitGrams != null ? String(suggestedUnitGrams) : 'ex: 55'}
              min="0"
              step="1"
              className="w-full px-4 py-3 bg-nourish-surface-high border border-nourish-border rounded-xl text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            />
            <p className="text-xs text-nourish-text-dim mt-1">
              Peso da unidade que contas na refeição (um ovo ≈ 55 g, uma lata), não o pack inteiro
              {getUnitGramsFromDesc(product.description) == null && suggestedUnitGrams != null
                ? ` · detectado ${suggestedUnitGrams} g no nome`
                : ''}
            </p>
          </div>
          {metaSaving && <p className="text-xs text-nourish-text-dim">A guardar…</p>}
        </section>

        <ProductMacrosSection
          macros={getMacrosFromDesc(product.description)}
          lookupNames={insaLookupNames({
            productName: product.name,
            description: product.description,
            generico,
          })}
          onSave={(next) => void handleSaveMacros(next)}
          onNetGrams={(grams) => void handleSaveCookingMeta({ unitGrams: String(grams) })}
          saving={macrosSaving}
        />

        {purchases.length > 0 && (
          <section>
            <h3 className="font-semibold text-nourish-text mb-3">
              {multiVariant ? 'Historial de compras (família)' : 'Historial de compras'}
            </h3>
            <div className="space-y-2">
              {purchases.map((entry) => {
                const matched = storePriceForPurchase(entry, storePrices)
                const entryProduct =
                  siblings.find((s) => s.id === entry.product_id) ?? product
                const entryCatalog = getPriceFromDesc(entryProduct.description)
                const storeLabel =
                  matched?.store_label ?? getStoreFromDesc(entryProduct.description) ?? storeFromDesc ?? null
                const storeBrand = storeLabel ? shortStoreBrand(storeLabel) : null
                const unitLabel = matched
                  ? formatUnitPrice(matched)
                  : entryCatalog != null &&
                      getPriceUnitFromDesc(entryProduct.description) === 'kg'
                    ? formatDespensaPriceLabel(entryCatalog, entryProduct.description)
                    : entryCatalog != null
                      ? `€${entryCatalog.toFixed(2)}`
                      : null
                const paid = (entry.price ?? 0) > 0 ? entry.price! : null
                const receipt = findReceiptForPurchase(entry, receipts, matched)
                const siblingName =
                  multiVariant && entry.product_id !== numId
                    ? nameById.get(entry.product_id)
                    : null

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
                      {(storeBrand || unitLabel || siblingName) && (
                        <p className="text-xs text-nourish-text-dim truncate mt-0.5">
                          {siblingName && (
                            <span className="text-nourish-text-dim">{siblingName}</span>
                          )}
                          {siblingName && (storeBrand || unitLabel) && ' · '}
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
                    {multiVariant && entry.product_id !== numId ? (
                      <button
                        type="button"
                        onClick={() => goToVariant(entry.product_id)}
                        className="p-3 text-nourish-text-dim text-[10px] font-medium shrink-0 focus:outline-none"
                        aria-label="Ver variante desta compra"
                      >
                        →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUndoEntry(entry)}
                        className="p-3 pr-3 text-nourish-border hover:text-red-400 transition-colors focus:outline-none"
                        aria-label="Anular registo"
                      >
                        <TrashIcon />
                      </button>
                    )}
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
              {multiVariant ? 'Remover esta variante' : 'Remover da despensa'}
            </button>
          ) : (
            <div className="space-y-2 p-3 rounded-xl bg-red-900/20 border border-red-800/50">
              <p className="text-sm text-red-300 text-center">
                {multiVariant
                  ? 'Só esta variante é apagada do Grocy. As outras da família ficam na despensa. Esta ação não pode ser desfeita.'
                  : 'O produto é apagado permanentemente do Grocy. Esta ação não pode ser desfeita.'}
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
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-sm flex justify-end px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
      >
        <button
          type="button"
          onClick={() => navigate(variantHref)}
          className="pointer-events-auto w-14 h-14 rounded-full bg-nourish-primary text-nourish-on-primary shadow-lg flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-offset-2 focus:ring-offset-nourish-bg"
          aria-label="Adicionar variante"
          title="Adicionar variante"
        >
          <PlusIcon />
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
