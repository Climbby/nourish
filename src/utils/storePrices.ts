export interface StorePriceItem {
  id: string
  store_id: string
  store_label: string
  product_name: string
  product_id: number | null
  unit_price: number
  qty: number | null
  /** How unit_price is measured — kg for weighed produce. */
  unit?: 'kg' | 'un' | null
  observed_at: string
  source: 'receipt' | 'manual'
}

export interface StoreSummary {
  store_id: string
  store_label: string
  observations: number
  product_count: number
}

export function priceUnitLabel(item: { unit?: string | null; qty?: number | null }): 'kg' | 'un' {
  if (item.unit === 'kg' || item.unit === 'un') return item.unit
  const n = Number(item.qty)
  if (Number.isFinite(n) && n > 0 && (n < 1 || !Number.isInteger(n))) return 'kg'
  return 'un'
}

export function formatUnitPrice(item: { unit_price: number; unit?: string | null; qty?: number | null }): string {
  const u = priceUnitLabel(item)
  const euro = `€${item.unit_price.toFixed(2)}`
  return u === 'kg' ? `${euro}/kg` : euro
}

export async function postStorePrices(payload: {
  store_id: string
  store_label: string
  observed_at?: string
  source?: 'receipt' | 'manual'
  items: {
    product_name: string
    product_id?: number | null
    unit_price: number
    qty?: number | null
    unit?: 'kg' | 'un'
  }[]
}): Promise<{ ok: boolean; added: number } | null> {
  try {
    const res = await fetch('/nourish/store-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return null
    return (await res.json()) as { ok: boolean; added: number }
  } catch {
    return null
  }
}

export async function fetchStorePrices(opts?: {
  store_id?: string
  q?: string
  limit?: number
}): Promise<{ items: StorePriceItem[]; stores: StoreSummary[]; total_observations: number } | null> {
  try {
    const url = new URL('/nourish/store-prices', window.location.origin)
    if (opts?.store_id) url.searchParams.set('store_id', opts.store_id)
    if (opts?.q) url.searchParams.set('q', opts.q)
    if (opts?.limit) url.searchParams.set('limit', String(opts.limit))
    const res = await fetch(url.pathname + url.search, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as {
      items: StorePriceItem[]
      stores: StoreSummary[]
      total_observations: number
    }
  } catch {
    return null
  }
}

export async function fetchStorePriceHistory(opts: {
  product_id?: number
  product_name?: string
  store_id?: string
}): Promise<StorePriceItem[] | null> {
  try {
    const url = new URL('/nourish/store-prices/history', window.location.origin)
    if (opts.product_id != null) url.searchParams.set('product_id', String(opts.product_id))
    if (opts.product_name) url.searchParams.set('product_name', opts.product_name)
    if (opts.store_id) url.searchParams.set('store_id', opts.store_id)
    const res = await fetch(url.pathname + url.search, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { items: StorePriceItem[] }
    return data.items
  } catch {
    return null
  }
}
