export type ReceiptStore = 'mixed' | 'continente' | 'auchan'

export interface ReceiptLine {
  raw: string
  name: string
  qty: number
  unitPrice: number
  lineTotal: number
}

/** How the line’s product association / name was initially chosen. */
export type ReviewNameOrigin = 'ocr' | 'fuzzy' | 'alias' | 'manual'

/**
 * User resolution for auto-selected supermarket SKU names:
 * - pending — still needs keep vs generic
 * - keep — leave SKU / link as-is
 * - generic — use / confirm a Generico family label
 */
export type GenericoChoice = 'pending' | 'keep' | 'generic'

export interface ReviewLine {
  id: string
  receiptLine: ReceiptLine
  productId: number | null
  /** Variant / SKU name used when creating a new Despensa product. */
  productName: string
  /** Shared family label written to [Generico] on create (or sync). */
  generico: string
  nameOrigin: ReviewNameOrigin
  genericoChoice: GenericoChoice
  stockAmount: number
  price: number
  included: boolean
}

/** Fill missing Generico fields on drafts saved before this shape. */
export function normalizeReviewLine(line: ReviewLine): ReviewLine {
  return {
    ...line,
    generico: typeof line.generico === 'string' ? line.generico : '',
    nameOrigin: line.nameOrigin ?? 'ocr',
    genericoChoice: line.genericoChoice ?? (line.nameOrigin === 'manual' ? 'keep' : 'pending'),
  }
}
