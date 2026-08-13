import type { Product } from '../../types/grocy'
import { getBuyAmountFromDesc, getGenericoFromDesc } from '../../utils/despensaAnalytics'
import {
  listKnownGenericos,
  suggestGenericoForName,
} from '../../utils/genericoSuggestions'
import { findBestProductMatch } from './matchProduct'
import { getAliasProductId } from './receiptAliases'
import type { ReviewLine, ReviewNameOrigin } from './types'

let lineIdCounter = 0

export function buildReviewLines(receiptLines: import('./types').ReceiptLine[], products: Product[]): ReviewLine[] {
  const known = listKnownGenericos(products)

  return receiptLines.map((receiptLine) => {
    const aliasId = getAliasProductId(receiptLine.name)
    const match = findBestProductMatch(receiptLine.name, products, aliasId)
    const productId = match?.productId ?? null
    const matched = productId != null ? products.find((p) => p.id === productId) : undefined
    const buyAmount =
      productId != null
        ? getBuyAmountFromDesc(matched?.description ?? null, productId)
        : Number.isInteger(receiptLine.qty) && receiptLine.qty >= 1
          ? receiptLine.qty
          : 1

    let nameOrigin: ReviewNameOrigin = 'ocr'
    if (aliasId != null && productId === aliasId) nameOrigin = 'alias'
    else if (match != null) nameOrigin = 'fuzzy'

    const fromProduct = matched ? getGenericoFromDesc(matched.description) : null
    const suggested = suggestGenericoForName(receiptLine.name, known)
    const generico = (fromProduct || suggested?.label || '').trim()

    return {
      id: `line-${++lineIdCounter}`,
      receiptLine,
      productId,
      productName: receiptLine.name,
      generico,
      nameOrigin,
      genericoChoice: 'pending',
      stockAmount: buyAmount,
      price: receiptLine.lineTotal,
      included: true,
    }
  })
}
