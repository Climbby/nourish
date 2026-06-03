export type ReceiptStore = 'mixed' | 'continente' | 'auchan'

export interface ReceiptLine {
  raw: string
  name: string
  qty: number
  unitPrice: number
  lineTotal: number
}

export interface ReviewLine {
  id: string
  receiptLine: ReceiptLine
  productId: number | null
  stockAmount: number
  price: number
  included: boolean
}
