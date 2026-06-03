import type { Product } from '../../types/grocy'
import { getBuyAmountFromDesc } from '../../utils/despensaAnalytics'
import { findBestProductMatch } from './matchProduct'
import { getAliasProductId } from './receiptAliases'
import type { ReceiptLine, ReviewLine } from './types'

let lineIdCounter = 0

export function buildReviewLines(receiptLines: ReceiptLine[], products: Product[]): ReviewLine[] {
  return receiptLines.map((receiptLine) => {
    const aliasId = getAliasProductId(receiptLine.name)
    const match = findBestProductMatch(receiptLine.name, products, aliasId)
    const productId = match?.productId ?? null
    const buyAmount =
      productId != null
        ? getBuyAmountFromDesc(
            products.find((p) => p.id === productId)?.description ?? null,
            productId
          )
        : 1

    return {
      id: `line-${++lineIdCounter}`,
      receiptLine,
      productId,
      stockAmount: buyAmount,
      price: receiptLine.lineTotal,
      included: productId != null,
    }
  })
}
