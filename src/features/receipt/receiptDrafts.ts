/**
 * Incomplete receipt review drafts — resume product association later.
 * Profile-scoped localStorage; keeps the last MAX_DRAFTS entries.
 */

import { profileScopedKey } from '../../utils/householdProfiles'
import type { ReceiptStore, ReviewLine } from './types'
import { normalizeReviewLine } from './types'

export const RECEIPT_DRAFTS_LEGACY_KEY = 'nourish-receipt-drafts'
export const MAX_RECEIPT_DRAFTS = 10

export type ReceiptDraftCaptureMode = 'full' | 'products'

export interface ReceiptDraft {
  id: string
  createdAt: string
  updatedAt: string
  store: ReceiptStore
  purchasedDate: string
  captureMode: ReceiptDraftCaptureMode
  reviewLines: ReviewLine[]
  visitEnteredAt?: string | null
  detectedStore?: ReceiptStore | null
  status: 'incomplete'
}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

function storageKey(profileId?: string | null): string {
  return profileScopedKey(RECEIPT_DRAFTS_LEGACY_KEY, profileId)
}

function isReviewLine(v: unknown): v is ReviewLine {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.productName === 'string' &&
    typeof o.stockAmount === 'number' &&
    typeof o.price === 'number' &&
    typeof o.included === 'boolean' &&
    o.receiptLine != null &&
    typeof o.receiptLine === 'object'
  )
}

function isDraft(v: unknown): v is ReceiptDraft {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.createdAt === 'string' &&
    typeof o.purchasedDate === 'string' &&
    Array.isArray(o.reviewLines) &&
    o.reviewLines.every(isReviewLine) &&
    o.status === 'incomplete'
  )
}

export function loadReceiptDrafts(profileId?: string | null): ReceiptDraft[] {
  if (!hasLocalStorage()) return []
  try {
    const key = storageKey(profileId)
    const raw = localStorage.getItem(key) ?? localStorage.getItem(RECEIPT_DRAFTS_LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isDraft)
      .map((d) => ({
        ...d,
        reviewLines: d.reviewLines.map(normalizeReviewLine),
      }))
      .slice(0, MAX_RECEIPT_DRAFTS)
  } catch {
    return []
  }
}

function saveAll(drafts: ReceiptDraft[], profileId?: string | null): void {
  if (!hasLocalStorage()) return
  try {
    localStorage.setItem(storageKey(profileId), JSON.stringify(drafts.slice(0, MAX_RECEIPT_DRAFTS)))
  } catch {
    /* quota / private mode */
  }
}

export function getReceiptDraft(id: string, profileId?: string | null): ReceiptDraft | null {
  return loadReceiptDrafts(profileId).find((d) => d.id === id) ?? null
}

/** Insert or replace a draft; newest updatedAt first; capped at MAX_RECEIPT_DRAFTS. */
export function upsertReceiptDraft(
  draft: Omit<ReceiptDraft, 'updatedAt' | 'status'> & {
    updatedAt?: string
    status?: 'incomplete'
  },
  profileId?: string | null
): ReceiptDraft {
  const now = new Date().toISOString()
  const next: ReceiptDraft = {
    ...draft,
    updatedAt: draft.updatedAt ?? now,
    status: 'incomplete',
    createdAt: draft.createdAt || now,
  }
  const others = loadReceiptDrafts(profileId).filter((d) => d.id !== next.id)
  const list = [next, ...others]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_RECEIPT_DRAFTS)
  saveAll(list, profileId)
  return next
}

export function removeReceiptDraft(id: string, profileId?: string | null): void {
  saveAll(
    loadReceiptDrafts(profileId).filter((d) => d.id !== id),
    profileId
  )
}

export function newReceiptDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function draftLineCount(draft: ReceiptDraft): number {
  return draft.reviewLines.filter((l) => l.included).length || draft.reviewLines.length
}

export function draftTotalEur(draft: ReceiptDraft): number {
  return draft.reviewLines
    .filter((l) => l.included)
    .reduce((sum, l) => sum + (l.price > 0 ? l.price : 0), 0)
}
