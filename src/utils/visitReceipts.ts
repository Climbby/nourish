import type { ReceiptStore } from '../features/receipt/types'

export interface VisitReceiptLink {
  visit_entered_at: string
  purchased_date: string
  item_count: number
  total_eur: number
  store?: ReceiptStore
  linked_at: string
}

export async function fetchVisitReceipts(): Promise<VisitReceiptLink[]> {
  try {
    const res = await fetch('/nourish/visit-receipts', { cache: 'no-store' })
    if (!res.ok) return loadLocalVisitReceipts()
    const data = (await res.json()) as { receipts?: VisitReceiptLink[] }
    const list = Array.isArray(data.receipts) ? data.receipts : []
    saveLocalVisitReceipts(list)
    return list
  } catch {
    return loadLocalVisitReceipts()
  }
}

export async function linkReceiptToVisit(link: VisitReceiptLink): Promise<void> {
  saveLocalVisitReceipt(link)
  try {
    await fetch('/nourish/visit-receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(link),
    })
  } catch {
    /* local fallback already saved */
  }
}

const LOCAL_KEY = 'nourish-visit-receipts'

function loadLocalVisitReceipts(): VisitReceiptLink[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalVisitReceipts(list: VisitReceiptLink[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
}

function saveLocalVisitReceipt(link: VisitReceiptLink) {
  const list = loadLocalVisitReceipts().filter((r) => r.visit_entered_at !== link.visit_entered_at)
  list.push(link)
  saveLocalVisitReceipts(list)
}

export function receiptMapByVisit(receipts: VisitReceiptLink[]): Map<string, VisitReceiptLink> {
  return new Map(receipts.map((r) => [r.visit_entered_at, r]))
}
