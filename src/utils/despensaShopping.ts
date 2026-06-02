import type { Product, StockItem, StockLogEntry } from '../types/grocy'
import { computeDespensaAnalytics, getBuyAmountFromDesc } from './despensaAnalytics'

export interface ShoppingNeed {
  productId: number
  productName: string
  daysRemaining: number
  daysUntilShop: number
  buyAmount: number
}

export function findDespensaShoppingNeeds(
  items: StockItem[],
  logsByProduct: Record<number, StockLogEntry[]>,
  daysUntilNextShop: number
): ShoppingNeed[] {
  const needs: ShoppingNeed[] = []

  for (const item of items) {
    const log = logsByProduct[item.product_id] ?? []
    const analytics = computeDespensaAnalytics(log, item.amount, daysUntilNextShop)
    if (!analytics?.isLow || analytics.daysRemaining === null) continue

    needs.push({
      productId: item.product_id,
      productName: item.product.name,
      daysRemaining: analytics.daysRemaining,
      daysUntilShop: daysUntilNextShop,
      buyAmount: getBuyAmountFromDesc(item.product.description, item.product.id),
    })
  }

  return needs.sort((a, b) => a.daysRemaining - b.daysRemaining)
}

export function medianShopIntervalDays(
  items: StockItem[],
  logsByProduct: Record<number, StockLogEntry[]>
): number | null {
  const intervals: number[] = []
  for (const item of items) {
    const a = computeDespensaAnalytics(logsByProduct[item.product_id] ?? [], item.amount)
    if (a?.avgDaysBetweenPurchases && a.avgDaysBetweenPurchases > 0) {
      intervals.push(a.avgDaysBetweenPurchases)
    }
  }
  if (intervals.length === 0) return null
  intervals.sort((a, b) => a - b)
  const mid = Math.floor(intervals.length / 2)
  return intervals.length % 2 === 0
    ? (intervals[mid - 1] + intervals[mid]) / 2
    : intervals[mid]
}
