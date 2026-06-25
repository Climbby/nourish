import { requestVisionJson } from '../../api/ai'
import type { ReceiptLine, ReceiptStore } from './types'

export interface VisionReceipt {
  store: ReceiptStore | 'other' | null
  /** Local wall-clock timestamp from the receipt, "YYYY-MM-DDTHH:mm" (no tz). */
  purchasedAt: string | null
  /** Date part of purchasedAt, "YYYY-MM-DD" (kept for the stock purchase date). */
  purchasedDate: string | null
  total: number | null
  lines: ReceiptLine[]
}

const SYSTEM_PROMPT = `És um leitor de talões de supermercado português. Recebes a foto de um talão (possivelmente com texto fino/desbotado e ligeiramente inclinado). Extrai APENAS as linhas de produtos comprados.

Ignora: cabeçalho, NIF, morada, IVA/impostos, subtotais e totais, troco, QR code, ATCUD, cartão/pontos de fidelização e rodapé.

Para cada produto devolve: nome (como impresso, sem códigos internos), quantidade, preço unitário e preço total da linha (EUR, ponto decimal). Para linhas a peso (kg) usa o peso como quantidade. Devolve também a loja, a data E HORA da compra (campo "Data Emissão", formato "YYYY-MM-DD HH:MM") e o total do talão.

Devolve APENAS JSON válido, sem texto à volta:
{ "store": "auchan|continente|other|null", "purchasedAt": "YYYY-MM-DD HH:MM|null", "total": number|null, "lines": [ { "name": string, "qty": number, "unitPrice": number, "lineTotal": number } ] }`

const MAX_EDGE = 2000

/** Parse "1,09" / "1.09" / "1,09 EUR" → 1.09; numbers pass through. */
export function parseNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const cleaned = v.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.+-]/g, '')
    const n = parseFloat(cleaned)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function normalizeDate(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const iso = v.trim().match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = v.trim().match(/(\d{2})[/-](\d{2})[/-](\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  return null
}

/** "2026-06-23 10:39" / "23/06/2026 10:39" → "2026-06-23T10:39"; date-only → null. */
export function normalizeDateTime(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const date = normalizeDate(v)
  if (!date) return null
  const time = v.match(/(\d{1,2}):(\d{2})/)
  if (!time) return null
  return `${date}T${time[1].padStart(2, '0')}:${time[2]}`
}

function normalizeStore(v: unknown): VisionReceipt['store'] {
  if (typeof v !== 'string') return null
  const s = v.toLowerCase()
  if (s.includes('auchan')) return 'auchan'
  if (s.includes('continente')) return 'continente'
  if (s === 'other') return 'other'
  return null
}

/** Validate + coerce the model's raw JSON into a VisionReceipt. Pure (no DOM). */
export function normalizeVisionReceipt(raw: unknown): VisionReceipt {
  const obj = (raw ?? {}) as Record<string, unknown>
  const linesRaw = Array.isArray(obj.lines) ? obj.lines : []
  const seen = new Set<string>()
  const lines: ReceiptLine[] = []

  for (const item of linesRaw) {
    const l = (item ?? {}) as Record<string, unknown>
    const name = String(l.name ?? '').trim()
    const lineTotal = parseNum(l.lineTotal)
    if (!name || lineTotal === null || lineTotal <= 0) continue

    const qtyParsed = parseNum(l.qty)
    const qty = qtyParsed && qtyParsed > 0 ? qtyParsed : 1
    const unitParsed = parseNum(l.unitPrice)
    const unitPrice = unitParsed && unitParsed > 0 ? unitParsed : lineTotal / qty

    const key = `${name.toLowerCase()}|${lineTotal.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)

    lines.push({ raw: name, name, qty, unitPrice, lineTotal })
  }

  const purchasedAt = normalizeDateTime(obj.purchasedAt)
  return {
    store: normalizeStore(obj.store),
    purchasedAt,
    purchasedDate: purchasedAt?.slice(0, 10) ?? normalizeDate(obj.purchasedAt ?? obj.purchasedDate),
    total: parseNum(obj.total),
    lines,
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Falha ao ler a imagem'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Falha ao processar a imagem'))
    img.src = src
  })
}

/** Downscale to ~MAX_EDGE long edge to keep thin text legible but bound cost/latency. */
export async function downscaleImage(file: File, maxEdge = MAX_EDGE): Promise<string> {
  const dataUrl = await fileToDataUrl(file)
  try {
    const img = await loadImage(dataUrl)
    const longest = Math.max(img.width, img.height)
    if (longest <= maxEdge) return dataUrl
    const scale = maxEdge / longest
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.9)
  } catch {
    return dataUrl
  }
}

export async function extractReceiptVision(file: File): Promise<VisionReceipt> {
  const imageDataUrl = await downscaleImage(file)
  const raw = await requestVisionJson(SYSTEM_PROMPT, 'Lê este talão.', imageDataUrl)
  return normalizeVisionReceipt(raw)
}
