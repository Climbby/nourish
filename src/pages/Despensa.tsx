import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { StockItem, StockLogEntry, ShoppingListItem } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { ConnectionError } from '../components/ConnectionError'
import { BottomSheet } from '../components/BottomSheet'
import { CartIcon, ShoppingListSheet } from '../components/ShoppingListSheet'
import { fetchHomelabMetrics, shopIntervalDays } from '../api/homelabMetrics'
import {
  computeDespensaAnalytics,
  despensaDisplayName,
  getBuyAmountFromDesc,
} from '../utils/despensaAnalytics'
import {
  familyMatchesQuery,
  filterFamiliesWithPhotos,
  groupDespensaFamilies,
  sortFamiliesByConsumption,
  type DespensaFamily,
} from '../utils/despensaFamilies'
import { useDisplayPrefs } from '../hooks/useDisplayPrefs'
import { useGenericoFavorites } from '../hooks/useGenericoFavorites'
import {
  ignoreReceiptNames,
  receiptIgnoreNamesForProducts,
} from '../features/receipt/receiptIgnore'

function TrashIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.499.058l.346-9Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

const iconBtn =
  'h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center bg-nourish-surface-high text-nourish-text-dim active:bg-nourish-border/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-nourish-primary disabled:opacity-100'

const sheetBtn =
  'w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-nourish-primary'

function ChevronIcon({ down }: { down: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`w-3.5 h-3.5 transition-transform ${down ? 'rotate-90' : ''}`}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

interface RemoveRequest {
  ids: number[]
  title: string
  variantCount: number
  names: string[]
}

interface DespensaRowProps {
  item: StockItem
  /** Override title (family Generico); defaults to product name / Generico. */
  title?: string
  subtitle?: string | null
  log: StockLogEntry[]
  onShoppingList: boolean
  onAddToShoppingList: (id: number) => void
  onRemove?: () => void
  daysUntilShop: number | null
  onOpen?: () => void
  onToggleExpand?: () => void
  expanded?: boolean
}

function DespensaListRow({
  item,
  title,
  subtitle,
  log,
  onShoppingList,
  onAddToShoppingList,
  onRemove,
  daysUntilShop,
  onOpen,
  onToggleExpand,
  expanded,
}: DespensaRowProps) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)
  const analytics = computeDespensaAnalytics(log, item.amount, daysUntilShop)
  const hasPhoto = Boolean(item.product.picture_file_name) && !imgError
  const displayTitle =
    title ?? despensaDisplayName(item.product.name, item.product.description)
  const openProduct = onOpen ?? (() => navigate(`/product/${item.product_id}`))

  return (
    <div className="flex items-center gap-1 pr-2">
      <button
        type="button"
        onClick={openProduct}
        className="flex shrink-0 items-center p-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-nourish-primary"
        aria-label={displayTitle}
      >
        {hasPhoto ? (
          <img
            src={grocy.productPictureUrl(item.product.picture_file_name!)}
            alt=""
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-nourish-surface-high"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-nourish-surface-high flex items-center justify-center text-xl flex-shrink-0">
            🛒
          </div>
        )}
      </button>

      <div className="min-w-0 flex-1 py-2">
        <div className="flex items-center gap-0.5 min-w-0">
          <button
            type="button"
            onClick={openProduct}
            className="min-w-0 overflow-hidden text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-nourish-primary"
          >
            <p className="text-sm font-semibold text-nourish-text truncate">
              {displayTitle}
              {analytics?.isLow && !onShoppingList && (
                <span className="ml-1.5 text-amber-500" aria-label="Stock baixo">
                  ⚠
                </span>
              )}
            </p>
          </button>
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="shrink-0 p-1 rounded-lg text-nourish-text-dim active:bg-nourish-border/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-nourish-primary"
              aria-label={expanded ? 'Ocultar variantes' : 'Ver stock por variante'}
              aria-expanded={expanded}
            >
              <ChevronIcon down={Boolean(expanded)} />
            </button>
          )}
        </div>
        {subtitle && (
          <p className="text-[10px] text-nourish-text-dim mt-0.5 truncate">{subtitle}</p>
        )}
        {analytics && item.amount > 0 && (
          <p className="text-[11px] text-nourish-text-dim mt-0.5 truncate">
            {analytics.dailyAvg.toFixed(1)}/dia
            {analytics.daysRemaining !== null && (
              <>
                {' '}
                · <span className="text-nourish-text">{analytics.daysRemaining.toFixed(1)} dias</span>
              </>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 mr-1">
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className={iconBtn}
            aria-label="Apagar da Despensa"
            title="Apagar da Despensa"
          >
            <TrashIcon />
          </button>
        )}
        <button
          type="button"
          onClick={() => onAddToShoppingList(item.product.id)}
          disabled={onShoppingList}
          className={`${iconBtn} ${
            onShoppingList ? 'bg-nourish-primary text-nourish-on-primary' : ''
          }`}
          aria-label={onShoppingList ? 'Na lista de compras' : 'Adicionar à lista de compras'}
        >
          <CartIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function FamilyBlock({
  family,
  logs,
  shoppingListProductIds,
  onAddToShoppingList,
  onRemoveRequest,
  daysUntilShop,
}: {
  family: DespensaFamily
  logs: Record<number, StockLogEntry[]>
  shoppingListProductIds: Set<number>
  onAddToShoppingList: (id: number) => void
  onRemoveRequest: (req: RemoveRequest) => void
  daysUntilShop: number | null
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const multi = family.variants.length > 1
  const primary = family.primary
  const familyItem: StockItem = { ...primary, amount: family.totalAmount }
  const mergedLog = family.variants.flatMap((v) => logs[v.product_id] ?? [])

  function requestRemove(items: StockItem[], title: string, includeGenerico: boolean) {
    onRemoveRequest({
      ids: items.map((v) => v.product_id),
      title,
      variantCount: items.length,
      names: receiptIgnoreNamesForProducts(
        items.map((v) => v.product),
        { includeGenerico }
      ),
    })
  }

  if (!multi) {
    const only = family.variants[0]
    return (
      <DespensaListRow
        item={only}
        title={family.title}
        log={logs[only.product_id] ?? []}
        onShoppingList={shoppingListProductIds.has(only.product_id)}
        onAddToShoppingList={onAddToShoppingList}
        onRemove={() => requestRemove([only], family.title, true)}
        daysUntilShop={daysUntilShop}
      />
    )
  }

  return (
    <div>
      <DespensaListRow
        item={familyItem}
        title={family.title}
        log={mergedLog}
        onShoppingList={family.variants.every((v) => shoppingListProductIds.has(v.product_id))}
        onAddToShoppingList={() => {
          const target =
            family.variants.find((v) => !shoppingListProductIds.has(v.product_id)) ?? primary
          onAddToShoppingList(target.product.id)
        }}
        onRemove={() => requestRemove(family.variants, family.title, true)}
        daysUntilShop={daysUntilShop}
        onOpen={() => navigate(`/product/${primary.product_id}`)}
        onToggleExpand={() => setExpanded((e) => !e)}
        expanded={expanded}
      />
      {expanded && (
        <ul className="border-t border-nourish-border/40 bg-nourish-bg/50">
          {family.variants.map((v) => (
            <li key={v.product_id} className="pl-4">
              <DespensaListRow
                item={v}
                title={v.product.name}
                log={logs[v.product_id] ?? []}
                onShoppingList={shoppingListProductIds.has(v.product_id)}
                onAddToShoppingList={onAddToShoppingList}
                onRemove={() => requestRemove([v], v.product.name, false)}
                daysUntilShop={daysUntilShop}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DespensaRemoveSheet({
  request,
  busy,
  onClose,
  onDelete,
  onIgnore,
}: {
  request: RemoveRequest | null
  busy: boolean
  onClose: () => void
  onDelete: () => void
  onIgnore: () => void
}) {
  const open = request != null
  const family = (request?.variantCount ?? 0) > 1

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Remover da despensa">
      {request && (
        <div className="px-4 pb-1 space-y-3">
          <div>
            <p className="text-sm font-semibold text-nourish-text truncate">{request.title}</p>
            <p className="text-xs text-nourish-text-dim mt-0.5 leading-snug">
              {family
                ? `Isto apaga as ${request.variantCount} variantes desta família da Despensa.`
                : 'O produto é apagado permanentemente do Grocy.'}
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className={`${sheetBtn} bg-red-500/15 text-red-400 border border-red-500/30`}
            >
              {busy ? 'A apagar…' : 'Apagar da Despensa'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onIgnore}
              className={`${sheetBtn} border border-nourish-border text-nourish-text`}
            >
              Ignorar
            </button>
            <p className="-mt-1 text-[11px] text-nourish-text-dim leading-snug px-1">
              {family
                ? 'Sai da Despensa e, no próximo talão, estas linhas começam desmarcadas.'
                : 'Sai da Despensa e, no próximo talão, esta linha começa desmarcada.'}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className={`${sheetBtn} border border-nourish-border text-nourish-text-dim font-medium`}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}

export function DespensaSection({
  query = '',
  shoppingListOpen = false,
  onShoppingListOpenChange,
  onShoppingListCountChange,
}: {
  query?: string
  shoppingListOpen?: boolean
  onShoppingListOpenChange?: (open: boolean) => void
  onShoppingListCountChange?: (count: number) => void
}) {
  const { prefs } = useDisplayPrefs()
  const { favorites } = useGenericoFavorites()
  const [items, setItems] = useState<StockItem[]>([])
  const [logs, setLogs] = useState<Record<number, StockLogEntry[]>>({})
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([])
  const [daysUntilShop, setDaysUntilShop] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removeRequest, setRemoveRequest] = useState<RemoveRequest | null>(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [despensaItems, sl, allLogs] = await Promise.all([
        grocy.getDespensaStock(),
        grocy.getShoppingList(),
        grocy.getAllStockLog(),
      ])
      setItems(despensaItems)
      setShoppingList(sl)
      onShoppingListCountChange?.(sl.filter((i) => !i.done).length)
      const productIds = new Set(despensaItems.map((item) => item.product_id))
      const logMap: Record<number, StockLogEntry[]> = {}
      for (const entry of allLogs) {
        if (productIds.has(entry.product_id)) {
          if (!logMap[entry.product_id]) logMap[entry.product_id] = []
          logMap[entry.product_id].push(entry)
        }
      }
      setLogs(logMap)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [onShoppingListCountChange])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetchHomelabMetrics().then((m) => {
      if (m) setDaysUntilShop(shopIntervalDays(m))
    })
  }, [])

  const handleAddToShoppingList = async (id: number) => {
    const product = items.find((s) => s.product_id === id)!.product
    try {
      await grocy.addToShoppingList(id, getBuyAmountFromDesc(product.description, product.id))
      const sl = await grocy.getShoppingList()
      setShoppingList(sl)
      onShoppingListCountChange?.(sl.filter((i) => !i.done).length)
    } catch {
      /* silent */
    }
  }

  const executeRemove = async (ignore: boolean) => {
    if (!removeRequest) return
    const { ids, names } = removeRequest
    const prev = items
    setRemoving(true)
    setItems((list) => list.filter((s) => !ids.includes(s.product_id)))
    setRemoveRequest(null)
    try {
      await Promise.all(ids.map((id) => grocy.deleteProduct(id)))
      if (ignore) ignoreReceiptNames(names)
    } catch {
      setItems(prev)
      void load()
    } finally {
      setRemoving(false)
    }
  }

  const pendingList = shoppingList.filter((i) => !i.done)
  const shoppingListProductIds = new Set(
    pendingList.flatMap((i) => (i.product_id != null && i.product_id > 0 ? [i.product_id] : []))
  )

  const families = sortFamiliesByConsumption(
    (() => {
      const matched = groupDespensaFamilies(items, favorites).filter((f) => familyMatchesQuery(f, query))
      return prefs.hideProductsWithoutImage ? filterFamiliesWithPhotos(matched, favorites) : matched
    })(),
    logs
  )
  const inStock = families.filter((f) => f.totalAmount > 0)
  const outOfStock = families.filter((f) => f.totalAmount <= 0)

  function renderFamilies(list: DespensaFamily[]) {
    return (
      <ul className="bg-nourish-surface border border-nourish-border rounded-xl overflow-hidden divide-y divide-nourish-border/60">
        {list.map((family) => (
          <li key={family.key}>
            <FamilyBlock
              family={family}
              logs={logs}
              shoppingListProductIds={shoppingListProductIds}
              onAddToShoppingList={handleAddToShoppingList}
              onRemoveRequest={setRemoveRequest}
              daysUntilShop={daysUntilShop}
            />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div>
      <ShoppingListSheet
        open={shoppingListOpen}
        onClose={() => onShoppingListOpenChange?.(false)}
        onListChange={() => {
          grocy.getShoppingList().then((sl) => {
            setShoppingList(sl)
            onShoppingListCountChange?.(sl.filter((i) => !i.done).length)
          })
        }}
      />
      <DespensaRemoveSheet
        request={removeRequest}
        busy={removing}
        onClose={() => {
          if (!removing) setRemoveRequest(null)
        }}
        onDelete={() => void executeRemove(false)}
        onIgnore={() => void executeRemove(true)}
      />

      {loading && (
        <div className="flex justify-center pt-12">
          <Spinner />
        </div>
      )}
      {!loading && error && (
        <div className="px-4 pt-12">
          <ConnectionError message={error} onRetry={() => void load()} />
        </div>
      )}
      {!loading && !error && (
        <>
          <div className="space-y-4">
            {inStock.length > 0 && (
              <div>
                <p className="px-1 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-nourish-text-dim">
                  Em stock
                </p>
                {renderFamilies(inStock)}
              </div>
            )}

            {outOfStock.length > 0 && renderFamilies(outOfStock)}
          </div>

          {families.length === 0 && items.length > 0 && (
            <p className="text-nourish-text-dim text-sm text-center pt-8">Sem resultados</p>
          )}
          {items.length === 0 && (
            <p className="text-nourish-text-dim text-sm text-center pt-8">
              Ainda não há produtos de despensa. Usa Adicionar → Produto de despensa.
            </p>
          )}
        </>
      )}
    </div>
  )
}
