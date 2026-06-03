import type { ReceiptLine } from '../types'

export function parseEuroAmount(s: string): number | null {
  const cleaned = s.replace(/\s/g, '').replace(',', '.')
  const m = cleaned.match(/(\d+\.?\d*)/)
  if (!m) return null
  const n = parseFloat(m[1])
  return isNaN(n) ? null : n
}

export function normalizeReceiptName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isReceiptHeaderOrFooter(line: string): boolean {
  const u = line.toUpperCase().trim()
  if (u.length < 3) return true
  const skip = [
    'TOTAL',
    'SUBTOTAL',
    'IVA',
    'TAXA',
    'TROCO',
    'CARTAO',
    'MULTIBANCO',
    'CONTRIBUINTE',
    'NIF',
    'OBRIGADO',
    'BEM VINDO',
    'TALAO',
    'FATURA',
    'RECIBO',
    'DATA',
    'HORA',
    'OPERADOR',
    'CAIXA',
    'PONTOS',
    'DESCONTO',
    'MB WAY',
    'DEBITO',
    'CREDITO',
  ]
  return skip.some((k) => u.includes(k))
}

export function dedupeLines(lines: ReceiptLine[]): ReceiptLine[] {
  const seen = new Set<string>()
  return lines.filter((l) => {
    const key = `${l.name}|${l.lineTotal}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
