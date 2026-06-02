export interface HomelabMetrics {
  supermarket_visits_week: number
  supermarket_visits_month: number
  leave_home_week: number
  leave_home_month: number
  avg_days_between_shops: number | null
  suggested_days_until_shop: number | null
}

export async function fetchHomelabMetrics(): Promise<HomelabMetrics | null> {
  try {
    const res = await fetch('/nourish/metrics')
    if (!res.ok) return null
    return res.json() as Promise<HomelabMetrics>
  } catch {
    return null
  }
}
