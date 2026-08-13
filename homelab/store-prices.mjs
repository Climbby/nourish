/**
 * Per-store product price observations (append-only JSONL).
 * Used by receipt commits and the prices website.
 */
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.NOURISH_DATA_DIR || '/opt/nourish/data'
const PRICES_FILE = process.env.NOURISH_STORE_PRICES_FILE || path.join(DATA_DIR, 'store-prices.jsonl')

/**
 * @typedef {{
 *   id: string
 *   store_id: string
 *   store_label: string
 *   product_name: string
 *   product_id: number | null
 *   unit_price: number
 *   qty: number | null
 *   unit: 'kg' | 'un' | null
 *   observed_at: string
 *   source: 'receipt' | 'manual'
 * }} StorePriceObservation
 */

export function storePricesPath() {
  return PRICES_FILE
}

/** Weight lines use fractional qty (kg); packaged goods use integer units. */
export function inferPriceUnit(qty) {
  const n = Number(qty)
  if (!Number.isFinite(n) || n <= 0) return 'un'
  if (n < 1 || !Number.isInteger(n)) return 'kg'
  return 'un'
}

/** @returns {StorePriceObservation[]} */
export function loadStorePrices(readFile = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '')) {
  const raw = readFile(PRICES_FILE)
  if (!raw.trim()) return []
  const out = []
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      const row = JSON.parse(t)
      if (row && typeof row.product_name === 'string' && Number.isFinite(row.unit_price)) {
        out.push(row)
      }
    } catch {
      /* skip bad lines */
    }
  }
  return out
}

/**
 * @param {StorePriceObservation[]} rows
 * @param {(p: string, data: string) => void} [appendFile]
 */
export function appendStorePrices(rows, appendFile = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.appendFileSync(p, data)
}) {
  if (!rows.length) return { ok: true, added: 0 }
  const chunk = rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
  appendFile(PRICES_FILE, chunk)
  return { ok: true, added: rows.length }
}

/**
 * Brand token from store_id: receipt.continente → continente,
 * zone.continente_bom_dia_… → continente.
 * @param {string} storeId
 * @returns {string | null}
 */
export function brandFromStoreId(storeId) {
  const id = String(storeId || '').toLowerCase()
  if (id.startsWith('receipt.')) {
    const brand = id.slice('receipt.'.length).trim()
    return brand || null
  }
  const brands = ['continente', 'auchan', 'intermarche', 'lidl', 'aldi', 'minipreco', 'pingo']
  for (const b of brands) {
    if (id.includes(b)) return b === 'pingo' ? 'pingodoce' : b
  }
  return null
}

/**
 * Collapse receipt.<brand> into the real zone.* store when both exist
 * (same Continente Bom Dia should not appear twice).
 * @param {StorePriceObservation[]} all
 * @returns {StorePriceObservation[]}
 */
export function withCanonicalStores(all) {
  /** @type {Map<string, { store_id: string, store_label: string }>} */
  const preferred = new Map()
  for (const row of all) {
    const brand = brandFromStoreId(row.store_id)
    if (!brand) continue
    const isZone = String(row.store_id).startsWith('zone.')
    const cur = preferred.get(brand)
    if (!cur) {
      preferred.set(brand, { store_id: row.store_id, store_label: row.store_label })
      continue
    }
    const curIsZone = cur.store_id.startsWith('zone.')
    if (isZone && !curIsZone) {
      preferred.set(brand, { store_id: row.store_id, store_label: row.store_label })
    } else if (isZone && curIsZone && String(row.store_label || '').length > String(cur.store_label || '').length) {
      preferred.set(brand, { store_id: row.store_id, store_label: row.store_label })
    }
  }

  return all.map((row) => {
    const brand = brandFromStoreId(row.store_id)
    const pref = brand ? preferred.get(brand) : null
    if (!pref || pref.store_id === row.store_id) return row
    return { ...row, store_id: pref.store_id, store_label: pref.store_label }
  })
}

/**
 * @param {StorePriceObservation[]} all
 * @param {{ store_id?: string, q?: string, limit?: number }} [opts]
 */
export function listLatestByProduct(all, opts = {}) {
  const rows = withCanonicalStores(all)
  const q = (opts.q || '').trim().toLowerCase()
  const storeId = opts.store_id || ''
  const limit = opts.limit ?? 200
  /** @type {Map<string, StorePriceObservation>} */
  const latest = new Map()
  const sorted = [...rows].sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at)))
  for (const row of sorted) {
    if (storeId && row.store_id !== storeId) continue
    if (q && !row.product_name.toLowerCase().includes(q) && !row.store_label.toLowerCase().includes(q)) {
      continue
    }
    const key = `${row.store_id}::${row.product_id ?? row.product_name.toLowerCase()}`
    if (!latest.has(key)) latest.set(key, row)
  }
  return [...latest.values()].slice(0, limit)
}

/**
 * @param {StorePriceObservation[]} all
 * @param {{ product_id?: number, product_name?: string, store_id?: string }} opts
 */
export function productHistory(all, opts) {
  const rows = withCanonicalStores(all)
  const name = (opts.product_name || '').trim().toLowerCase()
  const pid = opts.product_id
  const storeId = opts.store_id || ''
  return rows
    .filter((row) => {
      if (storeId && row.store_id !== storeId) return false
      if (pid != null && row.product_id === pid) return true
      if (name && row.product_name.toLowerCase() === name) return true
      return false
    })
    .sort((a, b) => String(a.observed_at).localeCompare(String(b.observed_at)))
}

/**
 * Distinct stores and product count for the prices site home.
 * @param {StorePriceObservation[]} all
 */
export function storeSummary(all) {
  const rows = withCanonicalStores(all)
  /** @type {Map<string, { store_id: string, store_label: string, observations: number, products: Set<string> }>} */
  const map = new Map()
  for (const row of rows) {
    let entry = map.get(row.store_id)
    if (!entry) {
      entry = {
        store_id: row.store_id,
        store_label: row.store_label,
        observations: 0,
        products: new Set(),
      }
      map.set(row.store_id, entry)
    }
    entry.observations += 1
    entry.products.add(String(row.product_id ?? row.product_name.toLowerCase()))
    entry.store_label = row.store_label || entry.store_label
  }
  return [...map.values()]
    .map((e) => ({
      store_id: e.store_id,
      store_label: e.store_label,
      observations: e.observations,
      product_count: e.products.size,
    }))
    .sort((a, b) => a.store_label.localeCompare(b.store_label, 'pt'))
}

export function newObservationId() {
  return `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
