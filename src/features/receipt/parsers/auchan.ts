import type { ReceiptLine } from '../types'
import { dedupeLines, isReceiptHeaderOrFooter, parseEuroAmount } from './utils'

/** Auchan: product lines often end with EUR amount */
const AUCHAN_LINE =
  /^(.{3,}?)\s+(\d+[,.]\d{2})\s*(?:EUR|€|A)?\s*$/i

const AUCHAN_WEIGHT_LINE =
  /^(.+?)\s+(\d+[,.]\d{3})\s*kg\s+(\d+[,.]\d{2})\s*$/i

export function parseAuchanReceipt(text: string): ReceiptLine[] {
  const lines: ReceiptLine[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim()
    if (!raw || isReceiptHeaderOrFooter(raw)) continue
    if (/AUCHAN|WELL'S/i.test(raw) && raw.length < 35) continue

    const weightM = raw.match(AUCHAN_WEIGHT_LINE)
    if (weightM) {
      const name = weightM[1].trim()
      const qty = parseEuroAmount(weightM[2]) ?? 1
      const lineTotal = parseEuroAmount(weightM[3])
      if (name && lineTotal !== null && lineTotal > 0) {
        lines.push({
          raw,
          name,
          qty,
          unitPrice: lineTotal / qty,
          lineTotal,
        })
      }
      continue
    }

    const m = raw.match(AUCHAN_LINE)
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
