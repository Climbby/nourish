import type { ReceiptLine } from '../types'
import { dedupeLines, isReceiptHeaderOrFooter, parseEuroAmount } from './utils'

/** Matches trailing price: "LEITE 1L 1,29" or "PRODUTO ... 2.50 EUR" */
const LINE_WITH_PRICE =
  /^(.+?)\s+(\d+[,.]\d{2})\s*(?:EUR|€)?\s*$/i

/** Quantity prefix: "2 x 1,50" or "2X" */
const QTY_PREFIX = /^(\d+)\s*[xX×]\s*/

export function parseGenericReceipt(text: string): ReceiptLine[] {
  const lines: ReceiptLine[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim()
    if (!raw || isReceiptHeaderOrFooter(raw)) continue

    let line = raw
    let qty = 1

    const qtyMatch = line.match(QTY_PREFIX)
    if (qtyMatch) {
      qty = parseInt(qtyMatch[1], 10) || 1
      line = line.slice(qtyMatch[0].length).trim()
    }

    const m = line.match(LINE_WITH_PRICE)
    if (!m) continue

    const name = m[1].trim()
    const lineTotal = parseEuroAmount(m[2])
    if (!name || lineTotal === null || lineTotal <= 0) continue
    if (name.length < 2) continue

    const unitPrice = qty > 0 ? lineTotal / qty : lineTotal
    lines.push({ raw, name, qty, unitPrice, lineTotal })
  }

  return dedupeLines(lines)
}
