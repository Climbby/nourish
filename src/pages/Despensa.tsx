import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { StockItem, StockLogEntry, ShoppingListItem } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { ConnectionError } from '../components/ConnectionError'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { CartIcon, ShoppingListButton, ShoppingListSheet } from '../components/ShoppingListSheet'
import { fetchHomelabMetrics, hasShopIntervalMedian, shopIntervalDays } from '../api/homelabMetrics'
import {
  computeDespensaAnalytics,
  despensaDisplayName,
  getBuyAmountFromDesc,
  getGenericoFromDesc,
} from '../utils/despensaAnalytics'
import {
  familyMatchesQuery,
  groupDespensaFamilies,
  sortFamiliesByConsumption,
  type DespensaFamily,
} from '../utils/despensaFamilies'
import { isVerified } from '../utils/verification'
import { useShowNutrition } from '../hooks/useShowNutrition'

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
  'h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center bg-nourish-surface-high text-nourish-text-dim active:bg-nourish-border/30 focus:outline-none focus:ring-2 focus:ring-nourish-primary disabled:opacity-100'

interface DespensaRowProps {
  item: StockItem
  /** Override title (family Generico); defaults to product name / Generico. */
  title?: string
  subtitle?: string | null
  log: StockLogEntry[]
  onShoppingList: boolean
  onAddToShoppingList: (id: number) => void
  onClearStock?: (id: number) => void
  daysUntilShop: number | null
  showNutrition: boolean
  /** When set, row opens expansion instead of navigating. */
  onToggleExpand?: () => void
  expanded?: boolean
  variantCount?: number
}

function DespensaListRow({
  item,
  title,
  subtitle,
  log,
  onShoppingList,
  onAddToShoppingList,
  onClearStock,
  daysUntilShop,
  showNutrition,
  onToggleExpand,
  expanded,
  variantCount,
}: DespensaRowProps) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const analytics = computeDespensaAnalytics(log, item.amount, daysUntilShop)
  const caloriesVerified = isVerified(item.product.description, 'calorias')
  const hasCalories = showNutrition && (item.product.calories ?? 0) > 0
  const hasPhoto = Boolean(item.product.picture_file_name) && !imgError
  const displayTitle =
    title ?? despensaDisplayName(item.product.name, item.product.description)

  useEffect(() => {
    if (!confirmClear) return
    const t = window.setTimeout(() => setConfirmClear(false), 3000)
    return () => window.clearTimeout(t)
  }, [confirmClear])

  return (
    <div className="flex items-center gap-1 pr-2">
      <button
        type="button"
        onClick={() => {
          if (onToggleExpand) onToggleExpand()
          else navigate(`/product/${item.product_id}`)
        }}
        className="flex-1 min-w-0 flex items-center gap-3 p-2 rounded-lg text-left active:bg-nourish-surface-high focus:outline-none focus:ring-2 focus:ring-inset focus:ring-nourish-primary"
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
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-nourish-text truncate">
            {displayTitle}
            {analytics?.isLow && !onShoppingList && (
              <span className="ml-1.5 text-amber-500" aria-label="Stock baixo">
                ⚠
              </span>
            )}
            {variantCount != null && variantCount > 1 && (
              <span className="ml-1.5 text-[10px] font-medium text-nourish-text-dim">
                · {variantCount} variantes
              </span>
            )}
            {expanded != null && variantCount != null && variantCount > 1 && (
              <span className="ml-1 text-nourish-text-dim text-xs">{expanded ? '▾' : '▸'}</span>
            )}
          </p>
          {subtitle && (
            <p className="text-[10px] text-nourish-text-dim mt-0.5 truncate">{subtitle}</p>
          )}
          {hasCalories && (
            <p className="text-xs text-nourish-text-dim tabular-nums mt-0.5 truncate inline-flex items-center gap-0.5">
              {item.product.calories} kcal
              {caloriesVerified && <VerifiedBadge verified />}
            </p>
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
      </button>

      <div className="flex items-center gap-1 flex-shrink-0 mr-1">
        {onClearStock && (
          <button
            type="button"
            onClick={() => {
              if (!confirmClear) {
                setConfirmClear(true)
                return
              }
              onClearStock(item.product_id)
            }}
            className={iconBtn}
            aria-label={confirmClear ? 'Confirmar esgotar stock' : 'Esgotar stock'}
            title={confirmClear ? 'Toca outra vez para esgotar' : 'Esgotar stock'}
          >
            {confirmClear ? (
              <span className="text-[10px] font-bold">OK</span>
            ) : (
              <TrashIcon />
            )}
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
  onClearStock,
  daysUntilShop,
  showNutrition,
  clearable,
}: {
  family: DespensaFamily
  logs: Record<number, StockLogEntry[]>
  shoppingListProductIds: Set<number>
  onAddToShoppingList: (id: number) => void
  onClearStock?: (id: number) => void
  daysUntilShop: number | null
  showNutrition: boolean
  clearable?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const multi = family.variants.length > 1
  const primary = family.primary
  // Synthetic amount for analytics on family header
  const familyItem: StockItem = { ...primary, amount: family.totalAmount }

  const mergedLog = family.variants.flatMap((v) => logs[v.product_id] ?? [])

  if (!multi) {
    const only = family.variants[0]
    return (
      <DespensaListRow
        item={only}
        title={family.title}
        subtitle={
          getGenericoFromDesc(only.product.description) && only.product.name !== family.title
            ? only.product.name
            : null
        }
        log={logs[only.product_id] ?? []}
        onShoppingList={shoppingListProductIds.has(only.product_id)}
        onAddToShoppingList={onAddToShoppingList}
        onClearStock={clearable ? onClearStock : undefined}
        daysUntilShop={daysUntilShop}
        showNutrition={showNutrition}
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
        onAddToShoppingList={(id) => {
          // Add primary (or first out-of-list) to shopping list
          const target =
            family.variants.find((v) => !shoppingListProductIds.has(v.product_id)) ?? primary
          onAddToShoppingList(target.product.id)
        }}
        onClearStock={undefined}
        daysUntilShop={daysUntilShop}
        showNutrition={showNutrition}
        onToggleExpand={() => setExpanded((e) => !e)}
        expanded={expanded}
        variantCount={family.variants.length}
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
                onClearStock={clearable && v.amount > 0 ? onClearStock : undefined}
                daysUntilShop={daysUntilShop}
                showNutrition={showNutrition}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function DespensaSection({ query = '' }: { query?: string }) {
  const showNutrition = useShowNutrition()
  const [items, setItems] = useState<StockItem[]>([])
  const [logs, setLogs] = useState<Record<number, StockLogEntry[]>>({})
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([])
  const [daysUntilShop, setDaysUntilShop] = useState<number | null>(null)
  const [shopIntervalFromMedian, setShopIntervalFromMedian] = useState(false)
  const [showList, setShowList] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetchHomelabMetrics().then((m) => {
      if (m) {
        setDaysUntilShop(shopIntervalDays(m))
        setShopIntervalFromMedian(hasShopIntervalMedian(m))
      }
    })
  }, [])

  const handleAddToShoppingList = async (id: number) => {
    const product = items.find((s) => s.product_id === id)!.product
    try {
      await grocy.addToShoppingList(id, getBuyAmountFromDesc(product.description, product.id))
      setShoppingList(await grocy.getShoppingList())
    } catch {
      /* silent */
    }
  }

  const handleClearStock = async (id: number) => {
    const prev = items.find((s) => s.product_id === id)
    setItems((list) =>
      list.map((s) => (s.product_id === id ? { ...s, amount: 0, value: 0 } : s))
    )
    try {
      await grocy.setStockAmount(id, 0)
      const newLog = await grocy.getStockLog(id)
      setLogs((l) => ({ ...l, [id]: newLog }))
    } catch {
      if (prev) {
        setItems((list) => list.map((s) => (s.product_id === id ? prev : s)))
      }
      load()
    }
  }

  const pendingList = shoppingList.filter((i) => !i.done)
  const shoppingListProductIds = new Set(pendingList.map((i) => i.product_id))

  const families = sortFamiliesByConsumption(
    groupDespensaFamilies(items).filter((f) => familyMatchesQuery(f, query)),
    logs
  )
  const inStock = families.filter((f) => f.totalAmount > 0)
  const outOfStock = families.filter((f) => f.totalAmount <= 0)

  function renderFamilies(list: DespensaFamily[], opts?: { clearable?: boolean }) {
    return (
      <ul className="bg-nourish-surface border border-nourish-border rounded-xl overflow-hidden divide-y divide-nourish-border/60">
        {list.map((family) => (
          <li key={family.key}>
            <FamilyBlock
              family={family}
              logs={logs}
              shoppingListProductIds={shoppingListProductIds}
              onAddToShoppingList={handleAddToShoppingList}
              onClearStock={opts?.clearable ? handleClearStock : undefined}
              daysUntilShop={daysUntilShop}
              showNutrition={showNutrition}
              clearable={opts?.clearable}
            />
          </li>
        ))}
      </ul>
    )
  }

  if (loading)
    return (
      <div className="flex justify-center pt-12">
        <Spinner />
      </div>
    )
  if (error) {
    return (
      <div className="px-4 pt-12">
        <ConnectionError message={error} onRetry={() => void load()} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        {daysUntilShop != null && (
          <p className="text-xs text-nourish-text-dim">
            Compras a cada{' '}
            <span className="font-semibold text-nourish-text">{daysUntilShop}</span> dias
            {shopIntervalFromMedian ? (
              <span className="text-nourish-text-dim/80"> · mediana do historial</span>
            ) : (
              <span className="text-nourish-text-dim/80"> · estimativa</span>
            )}
          </p>
        )}
        <ShoppingListButton count={pendingList.length} onClick={() => setShowList(true)} />
      </div>

      <ShoppingListSheet
        open={showList}
        onClose={() => setShowList(false)}
        onListChange={() => grocy.getShoppingList().then(setShoppingList)}
      />

      <div className="space-y-4">
        {inStock.length > 0 && (
          <div>
            <p className="px-1 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-nourish-text-dim">
              Em stock
            </p>
            {renderFamilies(inStock, { clearable: true })}
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
    </div>
  )
}
