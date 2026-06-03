import { grocy } from '../../api/grocy'
import type { ReviewLine } from './types'
import { setAlias } from './receiptAliases'

export interface CommitResult {
  succeeded: { lineId: string; productId: number }[]
  failed: { lineId: string; productId: number; error: string }[]
}

export async function commitReceiptLines(
  lines: ReviewLine[],
  purchasedDate: string,
  rememberAliases: boolean
): Promise<CommitResult> {
  const toCommit = lines.filter((l) => l.included && l.productId != null && l.stockAmount > 0)
  const succeeded: CommitResult['succeeded'] = []
  const failed: CommitResult['failed'] = []

  for (const line of toCommit) {
    try {
      await grocy.addStock(line.productId!, line.stockAmount, {
        price: line.price > 0 ? line.price : undefined,
        purchased_date: purchasedDate,
        note: `Talão: ${line.receiptLine.name}`,
      })
      succeeded.push({ lineId: line.id, productId: line.productId! })
      if (rememberAliases) {
        setAlias(line.receiptLine.name, line.productId!)
      }
    } catch (e) {
      failed.push({
        lineId: line.id,
        productId: line.productId!,
        error: e instanceof Error ? e.message : 'Erro desconhecido',
      })
    }
  }

  return { succeeded, failed }
}
