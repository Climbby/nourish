import type { StockLogEntry } from '../types/grocy'

export interface DespensaAnalytics {
  dailyAvg: number
  daysRemaining: number | null
  isLow: boolean
  avgDaysBetweenPurchases: number | null
}

export function getBuyAmountFromDesc(description: string | null, productId?: number): number {
  if (description) {
    const m = description.match(/\[BuyAmount\]\s*(\d+)/)
    if (m) return parseInt(m[1], 10)
  }
  const legacy: Record<number, number> = { 17: 6 }
  if (productId !== undefined && legacy[productId]) return legacy[productId]
  return 1
}

export function computeDespensaAnalytics(
  log: StockLogEntry[],
  currentAmount: number,
  daysUntilNextShop?: number | null
): DespensaAnalytics | null {
  const active = log.filter((e) => !e.undone)
  const consumes = active.filter((e) => e.transaction_type === 'consume' && e.amount < 0)
  if (consumes.length < 2) return null

  const sorted = [...consumes].sort(
    (a, b) =>
      new Date(a.row_created_timestamp).getTime() - new Date(b.row_created_timestamp).getTime()
  )
  const totalConsumed = sorted.reduce((sum, e) => sum + Math.abs(e.amount), 0)
  const spanMs =
    new Date(sorted[sorted.length - 1].row_created_timestamp).getTime() -
    new Date(sorted[0].row_created_timestamp).getTime()
  const spanDays = spanMs / (1000 * 60 * 60 * 24)
  if (spanDays < 0.1) return null

  const dailyAvg = totalConsumed / spanDays
  const daysRemaining = dailyAvg > 0 ? currentAmount / dailyAvg : null

  const purchases = active
    .filter((e) => e.transaction_type === 'purchase' && e.amount > 0)
    .map((e) => new Date(e.row_created_timestamp).getTime())
    .sort((a, b) => a - b)

  let avgDaysBetweenPurchases: number | null = null
  if (purchases.length >= 2) {
    const gaps = purchases.slice(1).map((d, i) => (d - purchases[i]) / (1000 * 60 * 60 * 24))
    avgDaysBetweenPurchases = gaps.reduce((a, b) => a + b, 0) / gaps.length
  }

  const shopHorizon = daysUntilNextShop ?? avgDaysBetweenPurchases
  const isLow =
    daysRemaining !== null &&
    shopHorizon !== null &&
    shopHorizon > 0 &&
    daysRemaining < shopHorizon

  return { dailyAvg, daysRemaining, isLow, avgDaysBetweenPurchases }
}
