import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import {
  fetchCatalog,
  fetchHistory,
  formatDay,
  formatUnitPrice,
  type StorePriceItem,
  type StoreSummary,
} from './api'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-leaf/15 bg-paper/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-end justify-between gap-4">
          <div>
            <Link to="/" className="block">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">Nourish</p>
              <h1 className="text-2xl font-bold text-ink tracking-tight">Preços</h1>
            </Link>
          </div>
          <p className="text-xs text-mute hidden sm:block max-w-[12rem] text-right leading-snug">
            Histórico por supermercado a partir dos talões
          </p>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const storeId = searchParams.get('store') ?? ''
  const [items, setItems] = useState<StorePriceItem[]>([])
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchCatalog({ q: q || undefined, store_id: storeId || undefined })
      .then((data) => {
        if (!mounted) return
        setItems(data.items)
        setStores(data.stores)
        setTotal(data.total_observations)
        setError(null)
      })
      .catch((e: Error) => {
        if (mounted) setError(e.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [q, storeId])

  return (
    <Shell>
      <form
        className="flex flex-col sm:flex-row gap-2 mb-6"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          const next = new URLSearchParams()
          const query = String(fd.get('q') || '').trim()
          const store = String(fd.get('store') || '')
          if (query) next.set('q', query)
          if (store) next.set('store', store)
          setSearchParams(next)
        }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Pesquisar produto…"
          className="flex-1 rounded-xl border border-leaf/20 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-moss"
        />
        <select
          name="store"
          defaultValue={storeId}
          className="rounded-xl border border-leaf/20 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-moss"
        >
          <option value="">Todas as lojas</option>
          {stores.map((s) => (
            <option key={s.store_id} value={s.store_id}>
              {s.store_label} ({s.product_count})
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-leaf text-white px-5 py-3 text-sm font-semibold hover:bg-moss transition-colors"
        >
          Filtrar
        </button>
      </form>

      <p className="text-sm text-mute mb-4">
        {total} observação{total !== 1 ? 'ões' : ''} · {stores.length} loja
        {stores.length !== 1 ? 's' : ''}
      </p>

      {loading && <p className="text-mute text-sm">A carregar…</p>}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}. Confirma que a API `/nourish/store-prices` está acessível.
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-mute text-sm py-12 text-center">
          Ainda sem preços. Escaneia um talão no Nourish para começar.
        </p>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={`${item.store_id}-${item.product_id ?? item.product_name}-${item.id}`}>
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/product?name=${encodeURIComponent(item.product_name)}&store=${encodeURIComponent(item.store_id)}${
                    item.product_id != null ? `&id=${item.product_id}` : ''
                  }`
                )
              }
              className="w-full text-left rounded-2xl border border-leaf/15 bg-white/80 px-4 py-3 hover:border-moss/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{item.product_name}</p>
                  <p className="text-xs text-mute mt-0.5">{item.store_label}</p>
                </div>
                <p className="text-lg font-bold tabular-nums text-leaf shrink-0">
                  {formatUnitPrice(item)}
                </p>
              </div>
              <p className="text-[11px] text-mute mt-1 tabular-nums">{formatDay(item.observed_at)}</p>
            </button>
          </li>
        ))}
      </ul>
    </Shell>
  )
}

function PriceLineChart({ rows }: { rows: StorePriceItem[] }) {
  const w = 320
  const h = 112
  const padX = 16
  const padTop = 16
  const padBottom = 28
  const chartH = h - padTop - padBottom
  const chartW = w - padX * 2

  const prices = rows.map((r) => r.unit_price)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const span = Math.max(maxP - minP, maxP * 0.08, 0.05)

  function xAt(i: number): number {
    if (rows.length === 1) return padX + chartW / 2
    return padX + (i / (rows.length - 1)) * chartW
  }

  function yAt(price: number): number {
    const t = (price - minP) / span
    return padTop + chartH - t * chartH
  }

  const points = rows.map((r, i) => ({ x: xAt(i), y: yAt(r.unit_price), row: r }))
  const linePath =
    points.length === 1
      ? `M ${padX} ${points[0].y} L ${padX + chartW} ${points[0].y}`
      : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="mb-3 -mx-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Evolução do preço">
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-moss"
        />
        {points.map((p) => (
          <circle
            key={p.row.id}
            cx={p.x}
            cy={p.y}
            r="4"
            className="fill-moss"
          >
            <title>{`${formatUnitPrice(p.row)} · ${formatDay(p.row.observed_at)}`}</title>
          </circle>
        ))}
        {points.map((p) => (
          <text
            key={`t-${p.row.id}`}
            x={p.x}
            y={h - 8}
            textAnchor="middle"
            fill="currentColor"
            className="text-mute"
            style={{ fontSize: 10 }}
          >
            {formatDay(p.row.observed_at)}
          </text>
        ))}
      </svg>
    </div>
  )
}

function ProductPage() {
  const [searchParams] = useSearchParams()
  const name = searchParams.get('name') || ''
  const storeId = searchParams.get('store') || undefined
  const productIdRaw = searchParams.get('id')
  const productId = productIdRaw ? Number(productIdRaw) : null
  const [history, setHistory] = useState<StorePriceItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!name) return
    let mounted = true
    setLoading(true)
    fetchHistory({
      product_name: name,
      product_id: productId,
      store_id: storeId,
    })
      .then((items) => {
        if (mounted) {
          setHistory(items)
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (mounted) setError(e.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [name, productId, storeId])

  const byStore = useMemo(() => {
    const map = new Map<string, StorePriceItem[]>()
    for (const row of history) {
      const list = map.get(row.store_id) ?? []
      list.push(row)
      map.set(row.store_id, list)
    }
    return [...map.entries()]
  }, [history])

  return (
    <Shell>
      <Link to="/" className="text-sm text-moss font-medium hover:underline">
        ← Catálogo
      </Link>
      <h2 className="text-2xl font-bold mt-3 text-ink">{name || 'Produto'}</h2>
      {loading && <p className="text-mute text-sm mt-4">A carregar…</p>}
      {error && <p className="text-red-700 text-sm mt-4">{error}</p>}

      {!loading && history.length === 0 && (
        <p className="text-mute text-sm mt-8">Sem histórico para este produto.</p>
      )}

      {byStore.map(([sid, rows]) => {
        const latest = rows[rows.length - 1]
        return (
          <section key={sid} className="mt-8">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h3 className="font-semibold text-ink">{latest.store_label}</h3>
              <p className="text-leaf font-bold tabular-nums">{formatUnitPrice(latest)}</p>
            </div>
            <div className="rounded-2xl border border-leaf/15 bg-white/70 p-4">
              <PriceLineChart rows={rows} />
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {[...rows].reverse().map((row) => (
                  <li key={row.id} className="flex justify-between text-sm gap-2">
                    <span className="text-mute tabular-nums">{formatDay(row.observed_at)}</span>
                    <span className="font-semibold tabular-nums">{formatUnitPrice(row)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )
      })}
    </Shell>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/product" element={<ProductPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}
