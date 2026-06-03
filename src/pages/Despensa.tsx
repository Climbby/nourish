import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { StockItem, StockLogEntry, ShoppingListItem } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { ShoppingListButton, ShoppingListSheet } from '../components/ShoppingListSheet'
import { fetchHomelabMetrics } from '../api/homelabMetrics'
import { computeDespensaAnalytics, getBuyAmountFromDesc } from '../utils/despensaAnalytics'

interface DespensaCardProps {
  item: StockItem
  log: StockLogEntry[]
  onShoppingList: boolean
  onConsume: (id: number) => void
  onAdd: (id: number) => void
  onAddToShoppingList: (id: number) => void
  daysUntilShop: number | null
}

function DespensaCard({
  item,
  log,
  onShoppingList,
  onConsume,
  onAdd,
  onAddToShoppingList,
  daysUntilShop,
}: DespensaCardProps) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)
  const analytics = computeDespensaAnalytics(log, item.amount, daysUntilShop)
  const buyAmount = getBuyAmountFromDesc(item.product.description, item.product.id)
  const pricePerUnit = item.amount > 0 && item.value > 0 ? item.value / item.amount : null

  return (
    <div className="bg-nourish-surface rounded-2xl overflow-hidden border border-nourish-border flex flex-col">
      {/* Image */}
      <button
        type="button"
        className="relative flex-shrink-0 w-full text-left focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-inset rounded-t-2xl"
        onClick={() => navigate(`/product/${item.product_id}`)}
      >
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
      </button>

      {/* Info */}
      <div className="p-3 space-y-2 flex flex-col flex-1">
        <button
          type="button"
          onClick={() => navigate(`/product/${item.product_id}`)}
          className="font-semibold text-nourish-text text-sm leading-snug text-left focus:outline-none focus:underline"
        >
          {item.product.name}
        </button>

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
  const [daysUntilShop, setDaysUntilShop] = useState<number | null>(null)
  const [showList, setShowList] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
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

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetchHomelabMetrics().then((m) => {
      if (m) setDaysUntilShop(m.days_until_shop)
    })
  }, [])

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
    const amount = getBuyAmountFromDesc(product.description, product.id)
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
      await grocy.addToShoppingList(id, getBuyAmountFromDesc(product.description, product.id))
      setShoppingList(await grocy.getShoppingList())
    } catch { /* silent */ }
  }

  const pendingList = shoppingList.filter((i) => !i.done)
  const shoppingListProductIds = new Set(pendingList.map((i) => i.product_id))
  const visible = items.filter(i =>
    !query || i.product.name.toLowerCase().includes(query.toLowerCase())
  )

  if (loading) return <div className="flex justify-center pt-12"><Spinner /></div>
  if (error) return <p className="text-nourish-text-dim text-sm text-center pt-12">{error}</p>

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        {daysUntilShop != null && (
          <p className="text-xs text-nourish-text-dim">
            Compras a cada <span className="font-semibold text-nourish-text">{daysUntilShop}</span> dias
          </p>
        )}
        <ShoppingListButton count={pendingList.length} onClick={() => setShowList(true)} />
      </div>

      <ShoppingListSheet
        open={showList}
        onClose={() => setShowList(false)}
        onListChange={() => grocy.getShoppingList().then(setShoppingList)}
      />

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
            daysUntilShop={daysUntilShop}
          />
        ))}
      </div>

      {visible.length === 0 && items.length > 0 && (
        <p className="text-nourish-text-dim text-sm text-center pt-8">Sem resultados</p>
      )}
      {items.length === 0 && (
        <p className="text-nourish-text-dim text-sm text-center pt-8">
          Ainda não há produtos de despensa. Usa + para adicionar um.
        </p>
      )}
    </div>
  )
}
