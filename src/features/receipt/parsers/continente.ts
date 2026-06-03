import type { ReceiptLine } from '../types'
import { dedupeLines, isReceiptHeaderOrFooter, parseEuroAmount } from './utils'

/** Continente: often "DESC  qty  price" or name ending with price column */
const CONTINENTE_LINE =
  /^(.{3,}?)\s+(\d+[,.]\d{2})\s*(?:[A-Z]{0,3})?\s*$/i

const CONTINENTE_QTY_LINE =
  /^(.+?)\s+(\d+[,.]\d{3})\s+(\d+[,.]\d{2})\s*$/i

export function parseContinenteReceipt(text: string): ReceiptLine[] {
  const lines: ReceiptLine[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim()
    if (!raw || isReceiptHeaderOrFooter(raw)) continue
    if (/CONTINENTE|MODEL(?:O|OS)/i.test(raw) && raw.length < 40) continue

    const qtyM = raw.match(CONTINENTE_QTY_LINE)
    if (qtyM) {
      const name = qtyM[1].trim()
      const qty = parseEuroAmount(qtyM[2]) ?? 1
      const lineTotal = parseEuroAmount(qtyM[3])
      if (name && lineTotal !== null && lineTotal > 0) {
        lines.push({
          raw,
          name,
          qty: qty >= 0.001 && qty < 100 ? qty : 1,
          unitPrice: lineTotal / (qty || 1),
          lineTotal,
        })
      }
      continue
    }

    const m = raw.match(CONTINENTE_LINE)
    if (!m) continue

    const name = m[1].trim()
    const lineTotal = parseEuroAmount(m[2])
    if (!name || lineTotal === null || lineTotal <= 0) continue

    lines.push({
      raw,
      name,
      qty: 1,
      unitPrice: lineTotal,
      lineTotal,
    })
  }

  return dedupeLines(lines)
}
