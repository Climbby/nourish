import type { VisitReceiptLink } from './visitReceipts'
import { formatTripCost } from './visitTripCost'

export function receiptTotalEur(receipt?: VisitReceiptLink): number | null {
  const total = receipt?.total_eur
  return Number.isFinite(total) && total! > 0 ? total! : null
}

export type VisitTotalCostKind = 'combined' | 'receipt'

export function visitTotalCostEur(
  receipt: VisitReceiptLink | undefined,
  fuelEur: number | null
): { total: number; kind: VisitTotalCostKind } | null {
  const receiptEur = receiptTotalEur(receipt)
  if (receiptEur != null && fuelEur != null) {
    const total = Math.round((receiptEur + fuelEur) * 100) / 100
    return { total, kind: 'combined' }
  }
  if (receiptEur != null) return { total: receiptEur, kind: 'receipt' }
  return null
}

export function formatVisitTotalCost(
  receipt: VisitReceiptLink | undefined,
  fuelEur: number | null
): { main: string; detail?: string } | null {
  const result = visitTotalCostEur(receipt, fuelEur)
  if (!result) return null

  if (result.kind === 'combined') {
    const receiptEur = receiptTotalEur(receipt)!
    return {
      main: formatTripCost(result.total),
      detail: `${formatTripCost(receiptEur)} talão + ${formatTripCost(fuelEur!)} combustível`,
    }
  }

  return { main: formatTripCost(result.total) }
}
