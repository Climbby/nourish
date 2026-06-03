import type { ReceiptLine, ReceiptStore } from '../types'
import { parseAuchanReceipt } from './auchan'
import { parseContinenteReceipt } from './continente'
import { parseGenericReceipt } from './generic'

export function detectStoreFromText(text: string): ReceiptStore | null {
  const u = text.toUpperCase()
  if (u.includes('CONTINENTE') || u.includes('MODEL CONTINENTE')) return 'continente'
  if (u.includes('AUCHAN') || u.includes("WELL'S")) return 'auchan'
  return null
}

export function parseReceipt(text: string, store: ReceiptStore): ReceiptLine[] {
  let lines: ReceiptLine[] = []

  if (store === 'continente') {
    lines = parseContinenteReceipt(text)
  } else if (store === 'auchan') {
    lines = parseAuchanReceipt(text)
  }

  if (store === 'mixed') {
    const detected = detectStoreFromText(text)
    if (detected === 'continente') lines = parseContinenteReceipt(text)
    else if (detected === 'auchan') lines = parseAuchanReceipt(text)
  }

  if (lines.length === 0) {
    lines = parseGenericReceipt(text)
  }

  return lines
}

export { parseGenericReceipt } from './generic'
export { parseContinenteReceipt } from './continente'
export { parseAuchanReceipt } from './auchan'
