import { useEffect, useState, useCallback } from 'react'
import { grocy } from '../api/grocy'
import type { StockItem, StockLogEntry, ShoppingListItem } from '../types/grocy'
import { Spinner } from '../components/Spinner'

const DESPENSA_GROUP_ID = 6

function getBuyAmount(product: { id: number; description: string | null }): number {
  if (product.description) {
    const m = product.description.match(/\[BuyAmount\]\s*(\d+)/)
    if (m) return parseInt(m[1], 10)
  }
  // Fallback for products created before buy amount was stored in description
  const legacy: Record<number, number> = { 17: 6 }
  return legacy[product.id] ?? 1
}

interface Analytics {
  dailyAvg: number
  daysRemaining: number | null
  isLow: boolean
  avgDaysBetweenPurchases: number | null
}

function computeAnalytics(log: StockLogEntry[], currentAmount: number): Analytics | null {
  const consumes = log.filter(e => e.transaction_type === 'consume' && e.amount < 0)
  if (consumes.length < 2) return null

  const sorted = [...consumes].sort(
    (a, b) => new Date(a.row_created_timestamp).getTime() - new Date(b.row_created_timestamp).getTime()
  )
  const totalConsumed = sorted.reduce((sum, e) => sum + Math.abs(e.amount), 0)
  const spanMs = new Date(sorted[sorted.length - 1].row_created_timestamp).getTime()
    - new Date(sorted[0].row_created_timestamp).getTime()
  const spanDays = spanMs / (1000 * 60 * 60 * 24)
  if (spanDays < 0.1) return null

  const dailyAvg = totalConsumed / spanDays
  const daysRemaining = dailyAvg > 0 ? currentAmount / dailyAvg : null

  const purchases = log
    .filter(e => e.transaction_type === 'purchase' && e.amount > 0)
    .map(e => new Date(e.row_created_timestamp).getTime())
    .sort((a, b) => a - b)

  let avgDaysBetweenPurchases: number | null = null
  if (purchases.length >= 2) {
    const gaps = purchases.slice(1).map((d, i) => (d - purchases[i]) / (1000 * 60 * 60 * 24))
    avgDaysBetweenPurchases = gaps.reduce((a, b) => a + b, 0) / gaps.length
  }

  const isLow =
    daysRemaining !== null &&
    avgDaysBetweenPurchases !== null &&
    daysRemaining < avgDaysBetweenPurchases

  return { dailyAvg, daysRemaining, isLow, avgDaysBetweenPurchases }
}

interface DespensaCardProps {
  item: StockItem
  log: StockLogEntry[]
  onShoppingList: boolean
  onConsume: (id: number) => void
  onAdd: (id: number) => void
  onAddToShoppingList: (id: number) => void
}

function DespensaCard({ item, log, onShoppingList, onConsume, onAdd, onAddToShoppingList }: DespensaCardProps) {
  const [imgError, setImgError] = useState(false)
  const analytics = computeAnalytics(log, item.amount)
  const buyAmount = getBuyAmount(item.product)
  const pricePerUnit = item.amount > 0 && item.value > 0 ? item.value / item.amount : null

  return (
    <div className="bg-nourish-surface rounded-2xl overflow-hidden border border-nourish-border flex flex-col">
      {/* Image */}
      <div className="relative flex-shrink-0">
        {item.product.picture_file_name && !imgError ? (
          <img
            src={grocy.productPictureUrl(item.product.picture_file_name)}
            alt={item.product.name}
            className="w-full object-cover"
            style={{ aspectRatio: '4/3' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full bg-nourish-surface-high flex items-center justify-center text-4xl" style={{ aspectRatio: '4/3' }}>
            🛒
          </div>
        )}
        {/* Stock quantity badge */}
        <span className="absolute top-2 right-2 bg-nourish-primary text-nourish-on-primary text-xs font-bold px-2 py-0.5 rounded-full">
          {item.amount}
        </span>
        {analytics?.isLow && !onShoppingList && (
          <span className="absolute top-2 left-2 bg-amber-500/90 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            ⚠
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2 flex flex-col flex-1">
        <h3 className="font-semibold text-nourish-text text-sm leading-snug">{item.product.name}</h3>

        {(pricePerUnit !== null || (item.product.calories ?? 0) > 0) && (
          <div className="flex items-center justify-between gap-1 flex-wrap">
            {pricePerUnit !== null && (
              <span className="text-nourish-primary text-xs font-semibold">€{pricePerUnit.toFixed(2)}</span>
            )}
            {(item.product.calories ?? 0) > 0 && (
              <span className="px-1.5 py-0.5 bg-nourish-surface-high rounded-full text-nourish-text-dim text-xs tabular-nums">
                {item.product.calories} kcal
              </span>
            )}
          </div>
        )}

        {analytics && (
          <p className="text-xs text-nourish-text-dim">
            {analytics.dailyAvg.toFixed(1)}/dia
            {analytics.daysRemaining !== null && (
              <> · <span className="text-nourish-text">{analytics.daysRemaining.toFixed(1)} dias</span></>
            )}
          </p>
        )}

        {analytics?.isLow && !onShoppingList && (
          <button
            onClick={() => onAddToShoppingList(item.product.id)}
            className="w-full text-xs py-1.5 px-2 rounded-xl border border-amber-500/50 text-amber-400 bg-amber-500/10 active:bg-amber-500/20 transition-colors"
          >
            Adicionar à lista
          </button>
        )}
        {analytics?.isLow && onShoppingList && (
          <p className="text-xs text-amber-400/70 text-center">Na lista de compras</p>
        )}

        {/* +/- buttons always at bottom */}
        <div className="flex gap-1.5 pt-1 mt-auto">
          <button
            onClick={() => onConsume(item.product.id)}
            disabled={item.amount <= 0}
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-nourish-surface-high text-nourish-text disabled:opacity-30 active:bg-nourish-surface-highest transition-colors"
          >
            −1
          </button>
          <button
            onClick={() => onAdd(item.product.id)}
            className="flex-1 py-2 rounded-xl text-xs font-bold bg-nourish-primary text-nourish-on-primary active:bg-nourish-primary-dim transition-colors"
          >
            +{buyAmount}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DespensaSection({ query = '' }: { query?: string }) {
  const [items, setItems] = useState<StockItem[]>([])
  const [logs, setLogs] = useState<Record<number, StockLogEntry[]>>({})
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [stock, sl] = await Promise.all([grocy.getStock(), grocy.getShoppingList()])
      const despensaItems = stock.filter(s => s.product.product_group_id === DESPENSA_GROUP_ID)
      setItems(despensaItems)
      setShoppingList(sl)
      const logEntries = await Promise.all(despensaItems.map(item => grocy.getStockLog(item.product_id)))
      const logMap: Record<number, StockLogEntry[]> = {}
      despensaItems.forEach((item, i) => { logMap[item.product_id] = logEntries[i] })
      setLogs(logMap)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleConsume = async (id: number) => {
    setItems(prev => prev.map(s => s.product_id === id ? { ...s, amount: Math.max(0, s.amount - 1) } : s))
    try {
      await grocy.consumeStock(id, 1)
      const newLog = await grocy.getStockLog(id)
      setLogs(prev => ({ ...prev, [id]: newLog }))
    } catch { load() }
  }

  const handleAdd = async (id: number) => {
    const product = items.find(s => s.product_id === id)!.product
    const amount = getBuyAmount(product)
    setItems(prev => prev.map(s => s.product_id === id ? { ...s, amount: s.amount + amount } : s))
    try {
      await grocy.addStock(id, amount)
      const [newLog, sl] = await Promise.all([grocy.getStockLog(id), grocy.getShoppingList()])
      setLogs(prev => ({ ...prev, [id]: newLog }))
      setShoppingList(sl)
    } catch { load() }
  }

  const handleAddToShoppingList = async (id: number) => {
    const product = items.find(s => s.product_id === id)!.product
    try {
      await grocy.addToShoppingList(id, getBuyAmount(product))
      setShoppingList(await grocy.getShoppingList())
    } catch { /* silent */ }
  }

  const shoppingListProductIds = new Set(shoppingList.filter(i => !i.done).map(i => i.product_id))
  const visible = items.filter(i =>
    !query || i.product.name.toLowerCase().includes(query.toLowerCase())
  )

  if (loading) return <div className="flex justify-center pt-12"><Spinner /></div>
  if (error) return <p className="text-nourish-text-dim text-sm text-center pt-12">{error}</p>

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {visible.map(item => (
          <DespensaCard
            key={item.product_id}
            item={item}
            log={logs[item.product_id] ?? []}
            onShoppingList={shoppingListProductIds.has(item.product_id)}
            onConsume={handleConsume}
            onAdd={handleAdd}
            onAddToShoppingList={handleAddToShoppingList}
          />
        ))}
      </div>

      {visible.length === 0 && items.length > 0 && (
        <p className="text-nourish-text-dim text-sm text-center pt-8">Sem resultados</p>
      )}
    </div>
  )
}
