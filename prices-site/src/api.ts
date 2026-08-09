export interface StorePriceItem {
  id: string
  store_id: string
  store_label: string
  product_name: string
  product_id: number | null
  unit_price: number
  qty: number | null
  unit?: 'kg' | 'un' | null
  observed_at: string
  source: string
}

export interface StoreSummary {
  store_id: string
  store_label: string
  observations: number
  product_count: number
}

export function formatUnitPrice(item: {
  unit_price: number
  unit?: string | null
  qty?: number | null
}): string {
  const n = Number(item.qty)
  const perKg =
    item.unit === 'kg' ||
    (Number.isFinite(n) && n > 0 && (n < 1 || !Number.isInteger(n)))
  const euro = `€${item.unit_price.toFixed(2)}`
  return perKg ? `${euro}/kg` : euro
}

export async function fetchCatalog(opts?: {
  store_id?: string
  q?: string
}): Promise<{ items: StorePriceItem[]; stores: StoreSummary[]; total_observations: number }> {
  const url = new URL('/nourish/store-prices', window.location.origin)
  if (opts?.store_id) url.searchParams.set('store_id', opts.store_id)
  if (opts?.q) url.searchParams.set('q', opts.q)
  const res = await fetch(url.pathname + url.search, { cache: 'no-store' })
  if (!res.ok) throw new Error('Falha ao carregar preços')
  return res.json()
}

export async function fetchHistory(opts: {
  product_id?: number | null
  product_name: string
  store_id?: string
}): Promise<StorePriceItem[]> {
  const url = new URL('/nourish/store-prices/history', window.location.origin)
  if (opts.product_id != null) url.searchParams.set('product_id', String(opts.product_id))
  url.searchParams.set('product_name', opts.product_name)
  if (opts.store_id) url.searchParams.set('store_id', opts.store_id)
  const res = await fetch(url.pathname + url.search, { cache: 'no-store' })
  if (!res.ok) throw new Error('Falha ao carregar histórico')
  const data = (await res.json()) as { items: StorePriceItem[] }
  return data.items
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
