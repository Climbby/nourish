#!/usr/bin/env node
/**
 * Despensa → shopping list check for n8n / Home Assistant.
 *
 * Env: GROCY_HOST (host:port), GROCY_API_KEY, DESPENSA_GROUP_ID (default 6)
 * Arg or env DAYS_UNTIL_SHOP — days until next supermarket trip
 */

const GROCY_HOST = process.env.GROCY_HOST || '192.168.1.61:9192'
const API_KEY = process.env.GROCY_API_KEY
const DESPENSA_GROUP_ID = parseInt(process.env.DESPENSA_GROUP_ID || '6', 10)
const DAYS_UNTIL_SHOP = parseFloat(
  process.argv[2] || process.env.DAYS_UNTIL_SHOP || '0'
)

if (!API_KEY) {
  console.error(JSON.stringify({ error: 'GROCY_API_KEY required' }))
  process.exit(1)
}

const base = GROCY_HOST.startsWith('http') ? GROCY_HOST : `http://${GROCY_HOST}`

async function api(path, options = {}) {
  const res = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      'GROCY-API-KEY': API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${path}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

function getBuyAmount(description, productId) {
  if (description) {
    const m = description.match(/\[BuyAmount\]\s*(\d+)/)
    if (m) return parseInt(m[1], 10)
  }
  if (productId === 17) return 6
  return 1
}

function computeAnalytics(log, currentAmount, daysUntilNextShop) {
  const consumes = log.filter((e) => e.transaction_type === 'consume' && e.amount < 0)
  if (consumes.length < 2) return null

  const sorted = [...consumes].sort(
    (a, b) => new Date(a.row_created_timestamp) - new Date(b.row_created_timestamp)
  )
  const totalConsumed = sorted.reduce((s, e) => s + Math.abs(e.amount), 0)
  const spanDays =
    (new Date(sorted[sorted.length - 1].row_created_timestamp) -
      new Date(sorted[0].row_created_timestamp)) /
    86400000
  if (spanDays < 0.1) return null

  const dailyAvg = totalConsumed / spanDays
  const daysRemaining = dailyAvg > 0 ? currentAmount / dailyAvg : null

  const purchases = log
    .filter((e) => e.transaction_type === 'purchase' && e.amount > 0)
    .map((e) => new Date(e.row_created_timestamp).getTime())
    .sort((a, b) => a - b)

  let avgDaysBetweenPurchases = null
  if (purchases.length >= 2) {
    const gaps = purchases.slice(1).map((d, i) => (d - purchases[i]) / 86400000)
    avgDaysBetweenPurchases = gaps.reduce((a, b) => a + b, 0) / gaps.length
  }

  const shopHorizon = daysUntilNextShop > 0 ? daysUntilNextShop : avgDaysBetweenPurchases
  const isLow =
    daysRemaining !== null &&
    shopHorizon !== null &&
    shopHorizon > 0 &&
    daysRemaining < shopHorizon

  return { daysRemaining, isLow, avgDaysBetweenPurchases }
}

function medianInterval(items, logsByProduct) {
  const intervals = []
  for (const item of items) {
    const a = computeAnalytics(logsByProduct[item.product_id] || [], item.amount, null)
    if (a?.avgDaysBetweenPurchases > 0) intervals.push(a.avgDaysBetweenPurchases)
  }
  if (intervals.length === 0) return null
  intervals.sort((a, b) => a - b)
  const mid = Math.floor(intervals.length / 2)
  return intervals.length % 2 === 0
    ? (intervals[mid - 1] + intervals[mid]) / 2
    : intervals[mid]
}

async function main() {
  const [stock, allLogs, shoppingList] = await Promise.all([
    api('/stock'),
    api('/objects/stock_log'),
    api('/objects/shopping_list'),
  ])

  const despensa = stock.filter((s) => s.product.product_group_id === DESPENSA_GROUP_ID)
  const logsByProduct = {}
  for (const entry of allLogs) {
    if (!logsByProduct[entry.product_id]) logsByProduct[entry.product_id] = []
    logsByProduct[entry.product_id].push(entry)
  }

  const onList = new Set(
    shoppingList.filter((i) => !i.done).map((i) => i.product_id)
  )

  let daysUntilShop = DAYS_UNTIL_SHOP
  const intervalHint = medianInterval(despensa, logsByProduct)
  if (!daysUntilShop || daysUntilShop <= 0) {
    daysUntilShop = intervalHint ?? 7
  }

  const added = []

  for (const item of despensa) {
    const log = logsByProduct[item.product_id] || []
    const analytics = computeAnalytics(log, item.amount, daysUntilShop)
    if (!analytics?.isLow || onList.has(item.product_id)) continue

    const amount = getBuyAmount(item.product.description, item.product_id)
    await api('/objects/shopping_list', {
      method: 'POST',
      body: JSON.stringify({ product_id: item.product_id, amount }),
    })

    added.push({
      productId: item.product_id,
      name: item.product.name,
      daysRemaining: Math.round(analytics.daysRemaining * 10) / 10,
      buyAmount: amount,
    })
    onList.add(item.product_id)
  }

  const summary =
    added.length === 0
      ? 'Despensa ok para o próximo supermercado.'
      : `Adicionado à lista: ${added.map((a) => a.name).join(', ')}`

  console.log(
    JSON.stringify({ daysUntilShop, intervalHint, added, summary }, null, 2)
  )
}

main().catch((e) => {
  console.error(JSON.stringify({ error: e.message }))
  process.exit(1)
})
