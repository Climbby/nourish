import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { StockItem, StockLogEntry, ShoppingListItem } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { CartIcon, ShoppingListButton, ShoppingListSheet } from '../components/ShoppingListSheet'
import { StockAmountSheet } from '../components/StockAmountSheet'
import { fetchHomelabMetrics, hasShopIntervalMedian, shopIntervalDays } from '../api/homelabMetrics'
import {
  computeDespensaAnalytics,
  getBuyAmountFromDesc,
  getDespensaUnitPrice,
  purchaseTotalPrice,
} from '../utils/despensaAnalytics'
import { isVerified } from '../utils/verification'

interface DespensaCardProps {
  item: StockItem
  log: StockLogEntry[]
  onShoppingList: boolean
  onConsume: (id: number) => void
  onAdd: (id: number) => void
  onAddToShoppingList: (id: number) => void
  onAdjustStock: (id: number) => void
  daysUntilShop: number | null
}

function DespensaCard({
  item,
  log,
  onShoppingList,
  onConsume,
  onAdd,
  onAddToShoppingList,
  onAdjustStock,
  daysUntilShop,
}: DespensaCardProps) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)
  const analytics = computeDespensaAnalytics(log, item.amount, daysUntilShop)
  const pricePerUnit = getDespensaUnitPrice(item.amount, item.value, item.product.description)
  const priceVerified = isVerified(item.product.description, 'preco')
  const caloriesVerified = isVerified(item.product.description, 'calorias')
  const hasCalories = (item.product.calories ?? 0) > 0

  return (
    <div className="bg-nourish-surface rounded-2xl overflow-hidden border border-nourish-border flex flex-col h-full">
      {/* Image */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-inset rounded-t-2xl"
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
        </button>
        <button
          type="button"
          onClick={() => onAdjustStock(item.product_id)}
          className="absolute top-1.5 right-1.5 bg-nourish-primary text-nourish-on-primary text-xs font-bold px-2 py-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label={`Stock: ${item.amount}. Toca para corrigir`}
        >
          {item.amount}
        </button>
        <button
          type="button"
          onClick={() => onAddToShoppingList(item.product.id)}
          disabled={onShoppingList}
          className={`absolute bottom-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center shadow-sm backdrop-blur-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-100 ${
            onShoppingList
              ? 'bg-nourish-primary text-nourish-on-primary'
              : analytics?.isLow
                ? 'bg-amber-500/90 text-white active:bg-amber-600'
                : 'bg-black/55 text-white active:bg-black/70'
          }`}
          aria-label={onShoppingList ? 'Na lista de compras' : 'Adicionar à lista de compras'}
        >
          <CartIcon className="w-3 h-3" />
        </button>
        {analytics?.isLow && !onShoppingList && (
          <span className="absolute top-2 left-2 bg-amber-500/90 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            ⚠
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 min-h-0">
        <button
          type="button"
          onClick={() => navigate(`/product/${item.product_id}`)}
          className="font-semibold text-nourish-text text-sm leading-snug line-clamp-2 min-h-[2.5rem] text-left focus:outline-none focus:underline"
        >
          {item.product.name}
        </button>

        <div className="min-h-[1.25rem] flex items-center justify-between gap-1 flex-wrap">
          {pricePerUnit !== null && (
            <span className="text-nourish-primary text-xs font-semibold inline-flex items-center gap-1">
              €{pricePerUnit.toFixed(2)}
              {priceVerified && <VerifiedBadge verified />}
            </span>
          )}
          {hasCalories && (
            <span className="px-1.5 py-0.5 bg-nourish-surface-high rounded-full text-nourish-text-dim text-xs tabular-nums inline-flex items-center gap-1 ml-auto">
              {item.product.calories} kcal
              {caloriesVerified && <VerifiedBadge verified />}
            </span>
          )}
        </div>

        <div className="min-h-[1rem]">
          {analytics && (
            <p className="text-xs text-nourish-text-dim">
              {analytics.dailyAvg.toFixed(1)}/dia
              {analytics.daysRemaining !== null && (
                <> · <span className="text-nourish-text">{analytics.daysRemaining.toFixed(1)} dias</span></>
              )}
            </p>
          )}
        </div>

        <div className="flex gap-1.5 pt-2 mt-auto">
          <button
            type="button"
            onClick={() => onConsume(item.product.id)}
            disabled={item.amount <= 0}
            className="flex-1 h-9 rounded-xl text-xs font-semibold bg-nourish-surface-high text-nourish-text disabled:opacity-30 active:bg-nourish-surface-highest transition-colors"
          >
            Consumir
          </button>
          <button
            type="button"
            onClick={() => onAdd(item.product.id)}
            className="flex-1 h-9 rounded-xl text-xs font-semibold bg-nourish-primary text-nourish-on-primary active:bg-nourish-primary-dim transition-colors"
          >
            Comprar
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
  const [shopIntervalFromMedian, setShopIntervalFromMedian] = useState(false)
  const [showList, setShowList] = useState(false)
  const [stockEditId, setStockEditId] = useState<number | null>(null)
  const [stockSaving, setStockSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const stockEditItem = stockEditId != null ? items.find((i) => i.product_id === stockEditId) : null

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
      if (m) {
        setDaysUntilShop(shopIntervalDays(m))
        setShopIntervalFromMedian(hasShopIntervalMedian(m))
      }
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
    const stockItem = items.find((s) => s.product_id === id)!
    const product = stockItem.product
    const amount = getBuyAmountFromDesc(product.description, product.id)
    const unitPrice = getDespensaUnitPrice(stockItem.amount, stockItem.value, product.description)
    const totalPrice = purchaseTotalPrice(unitPrice, amount)
    setItems(prev => prev.map(s => s.product_id === id ? { ...s, amount: s.amount + amount } : s))
    try {
      await grocy.addStock(id, amount, totalPrice != null ? { price: totalPrice } : undefined)
      const [newLog, sl] = await Promise.all([grocy.getStockLog(id), grocy.getShoppingList()])
      setLogs(prev => ({ ...prev, [id]: newLog }))
      setShoppingList(sl)
    } catch { load() }
  }

  const handleSaveStock = async (newAmount: number) => {
    if (stockEditId == null) return
    setStockSaving(true)
    try {
      await grocy.setStockAmount(stockEditId, newAmount)
      setItems((prev) =>
        prev.map((s) => (s.product_id === stockEditId ? { ...s, amount: newAmount } : s))
      )
      const newLog = await grocy.getStockLog(stockEditId)
      setLogs((prev) => ({ ...prev, [stockEditId]: newLog }))
      setStockEditId(null)
    } catch {
      load()
    } finally {
      setStockSaving(false)
    }
  }

  const handleRemoveProduct = async () => {
    if (stockEditId == null) return
    setStockSaving(true)
    try {
      await grocy.deleteProduct(stockEditId)
      setStockEditId(null)
      await load()
    } catch {
      load()
    } finally {
      setStockSaving(false)
    }
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

      <StockAmountSheet
        open={stockEditItem != null}
        productName={stockEditItem?.product.name ?? ''}
        amount={stockEditItem?.amount ?? 0}
        saving={stockSaving}
        onClose={() => setStockEditId(null)}
        onSave={handleSaveStock}
        onRemove={handleRemoveProduct}
      />

      <div className="grid grid-cols-2 gap-3 items-stretch">
        {visible.map(item => (
          <DespensaCard
            key={item.product_id}
            item={item}
            log={logs[item.product_id] ?? []}
            onShoppingList={shoppingListProductIds.has(item.product_id)}
            onConsume={handleConsume}
            onAdd={handleAdd}
            onAddToShoppingList={handleAddToShoppingList}
            onAdjustStock={setStockEditId}
            daysUntilShop={daysUntilShop}
          />
        ))}
      </div>

      {visible.length === 0 && items.length > 0 && (
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
