import { grocy } from '../../api/grocy'
import { grocyConfig } from '../../config/grocy'
import {
  buildDespensaDescription,
  getBuyAmountFromDesc,
  getGenericoFromDesc,
  getPriceFromDesc,
  getUnitGramsFromDesc,
  inferUnitGramsFromNames,
} from '../../utils/despensaAnalytics'
import { parseVerifiedFields } from '../../utils/verification'
import type { ReviewLine } from './types'
import { setAlias } from './receiptAliases'
import { syncReceiptIgnoreFromReview } from './receiptIgnore'

export interface CommitResult {
  succeeded: { lineId: string; productId: number; created?: boolean }[]
  failed: { lineId: string; productId: number | null; error: string }[]
  /** Product ids resolved/created even if stock add failed — for store-prices. */
  productIds: { lineId: string; productId: number }[]
}

function lineUnitPrice(line: ReviewLine): number | null {
  if (line.receiptLine.unitPrice > 0) return line.receiptLine.unitPrice
  if (line.price > 0) return line.price
  return null
}

function linePriceUnit(line: ReviewLine): 'kg' | 'un' {
  const qty = line.receiptLine.qty
  if (qty > 0 && (qty < 1 || !Number.isInteger(qty))) return 'kg'
  return 'un'
}

function lineUnitGrams(line: ReviewLine): number | null {
  if (linePriceUnit(line) === 'kg') return null
  return inferUnitGramsFromNames(line.productName, line.receiptLine.name)
}

/** Generico to persist only after user chose “Definir genérico”. */
function lineGenerico(line: ReviewLine): string | null {
  if (line.genericoChoice !== 'generic') return null
  const g = line.generico?.trim()
  return g || null
}

async function ensureProductId(
  line: ReviewLine,
  storeLabel?: string | null
): Promise<{ productId: number; created: boolean }> {
  if (line.productId != null) return { productId: line.productId, created: false }

  const name = (line.productName || line.receiptLine.name).trim()
  if (!name) throw new Error('Nome de produto em falta')

  const unitPrice = lineUnitPrice(line)
  const buyAmount =
    Number.isInteger(line.stockAmount) && line.stockAmount >= 1 ? line.stockAmount : 1
  const generico = lineGenerico(line)

  const result = await grocy.createProduct({
    name,
    product_group_id: grocyConfig.despensaGroupId,
    location_id: grocyConfig.defaultLocationId,
    qu_id_purchase: grocyConfig.defaultQuId,
    qu_id_stock: grocyConfig.defaultQuId,
    qu_id_consume: grocyConfig.defaultQuId,
    qu_id_price: grocyConfig.defaultQuId,
    calories: null,
    active: 1,
    quick_consume_amount: 1,
    default_best_before_days: 0,
    description: buildDespensaDescription(buyAmount, unitPrice, {
      verified: unitPrice != null ? new Set(['preco']) : new Set(),
      storeLabel,
      priceUnit: linePriceUnit(line),
      generico,
      nomeCurto: generico,
      unitGrams: lineUnitGrams(line),
    }),
  })
  return { productId: result.created_object_id, created: true }
}

/** Persist receipt unit price + store (+ Generico when resolving) on the product. */
async function syncProductFromReceipt(
  productId: number,
  line: ReviewLine,
  storeLabel?: string | null
): Promise<void> {
  const prod = await grocy.getProduct(productId)
  const unitPrice = lineUnitPrice(line) ?? getPriceFromDesc(prod.description)
  const buyAmount = getBuyAmountFromDesc(prod.description, productId)
  const verified = parseVerifiedFields(prod.description)
  if (unitPrice != null) verified.add('preco')
  const existingGen = getGenericoFromDesc(prod.description)
  const fromLine = lineGenerico(line)
  const generico = existingGen || fromLine
  const unitGrams = getUnitGramsFromDesc(prod.description) ?? lineUnitGrams(line)
  await grocy.updateProduct(productId, {
    description: buildDespensaDescription(buyAmount, unitPrice, {
      verified,
      storeLabel,
      existingDescription: prod.description,
      priceUnit: linePriceUnit(line),
      generico: generico ?? undefined,
      unitGrams: unitGrams ?? undefined,
    }),
  })
}

export async function commitReceiptLines(
  lines: ReviewLine[],
  purchasedDate: string,
  rememberAliases: boolean,
  opts?: { storeLabel?: string | null }
): Promise<CommitResult> {
  const toCommit = lines.filter((l) => l.included && l.stockAmount > 0)
  syncReceiptIgnoreFromReview(
    lines.map((l) => ({
      included: l.included,
      names: [l.receiptLine.name, l.productName],
    }))
  )
  const succeeded: CommitResult['succeeded'] = []
  const failed: CommitResult['failed'] = []
  const productIds: CommitResult['productIds'] = []
  const storeLabel = opts?.storeLabel ?? null

  for (const line of toCommit) {
    let productId: number | null = line.productId
    let created = false
    try {
      const ensured = await ensureProductId(line, storeLabel)
      productId = ensured.productId
      created = ensured.created
      productIds.push({ lineId: line.id, productId })
      await syncProductFromReceipt(productId, line, storeLabel)

      await grocy.addStock(productId, line.stockAmount, {
        price: line.price > 0 ? line.price : undefined,
        purchased_date: purchasedDate,
        note: `Talão: ${line.receiptLine.name}`,
      })
      succeeded.push({ lineId: line.id, productId, created })
      if (rememberAliases) {
        setAlias(line.receiptLine.name, productId)
      }
    } catch (e) {
      failed.push({
        lineId: line.id,
        productId,
        error: e instanceof Error ? e.message : 'Erro desconhecido',
      })
    }
  }

  return { succeeded, failed, productIds }
}
