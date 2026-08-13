import { beforeEach, describe, expect, it } from 'vitest'
import type { ReviewLine } from './types'
import {
  getReceiptDraft,
  loadReceiptDrafts,
  MAX_RECEIPT_DRAFTS,
  newReceiptDraftId,
  removeReceiptDraft,
  upsertReceiptDraft,
} from './receiptDrafts'

function line(id: string, name: string): ReviewLine {
  return {
    id,
    receiptLine: { raw: name, name, qty: 1, unitPrice: 1.5, lineTotal: 1.5 },
    productId: null,
    productName: name,
    generico: '',
    nameOrigin: 'ocr',
    genericoChoice: 'pending',
    stockAmount: 1,
    price: 1.5,
    included: true,
  }
}

function baseDraft(id: string, updatedAt: string) {
  return {
    id,
    createdAt: updatedAt,
    store: 'continente' as const,
    purchasedDate: '2026-08-12',
    captureMode: 'full' as const,
    reviewLines: [line('l1', 'Leite')],
  }
}

describe('receiptDrafts', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('upserts and loads a draft', () => {
    const saved = upsertReceiptDraft(baseDraft('a', '2026-08-12T10:00:00.000Z'))
    expect(saved.status).toBe('incomplete')
    expect(loadReceiptDrafts()).toHaveLength(1)
    expect(getReceiptDraft('a')?.reviewLines[0].productName).toBe('Leite')
  })

  it('updates in place and sorts by updatedAt', () => {
    upsertReceiptDraft(baseDraft('old', '2026-08-01T10:00:00.000Z'))
    upsertReceiptDraft(baseDraft('new', '2026-08-12T10:00:00.000Z'))
    upsertReceiptDraft({
      ...baseDraft('old', '2026-08-01T10:00:00.000Z'),
      updatedAt: '2026-08-13T10:00:00.000Z',
      reviewLines: [line('l1', 'Pão')],
    })
    const list = loadReceiptDrafts()
    expect(list.map((d) => d.id)).toEqual(['old', 'new'])
    expect(list[0].reviewLines[0].productName).toBe('Pão')
  })

  it('caps at MAX_RECEIPT_DRAFTS', () => {
    for (let i = 0; i < MAX_RECEIPT_DRAFTS + 3; i++) {
      upsertReceiptDraft({
        ...baseDraft(`d${i}`, `2026-08-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`),
      })
    }
    expect(loadReceiptDrafts()).toHaveLength(MAX_RECEIPT_DRAFTS)
  })

  it('removes a draft', () => {
    upsertReceiptDraft(baseDraft('x', '2026-08-12T10:00:00.000Z'))
    removeReceiptDraft('x')
    expect(loadReceiptDrafts()).toEqual([])
  })

  it('generates unique ids', () => {
    expect(newReceiptDraftId()).not.toBe(newReceiptDraftId())
  })
})
