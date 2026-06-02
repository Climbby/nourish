export interface HomelabMetrics {
  days_until_shop: number
  supermarket_visits_week: number
  supermarket_visits_month: number
  leave_home_week: number
  leave_home_month: number
  avg_days_between_shops: number | null
  suggested_days_until_shop: number
}

const DEFAULT_DAYS_UNTIL_SHOP = 4

export function defaultDaysUntilShop(): number {
  return DEFAULT_DAYS_UNTIL_SHOP
}

export async function fetchHomelabMetrics(): Promise<HomelabMetrics | null> {
  try {
    const res = await fetch('/nourish/metrics', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as HomelabMetrics
    const days = Number(data.days_until_shop ?? data.suggested_days_until_shop)
    return {
      ...data,
      days_until_shop: Number.isFinite(days) && days > 0 ? days : DEFAULT_DAYS_UNTIL_SHOP,
      suggested_days_until_shop:
        Number(data.suggested_days_until_shop) > 0
          ? Number(data.suggested_days_until_shop)
          : Number.isFinite(days) && days > 0
            ? days
            : DEFAULT_DAYS_UNTIL_SHOP,
    }
  } catch {
    return null
  }
}
