/**
 * Map heard shopping names onto the Despensa catalogue.
 * Exact accent/case-insensitive match only (same as meals).
 * Talão ignore-list blocks auto-link; the spoken name can still be added unlinked.
 */

import type { Product, ShoppingListItem } from '../types/grocy'
import { isReceiptNameIgnored } from '../features/receipt/receiptIgnore'
import {
  cookingName,
  getBuyAmountFromDesc,
  getGenericoFromDesc,
} from './despensaAnalytics'
import type { GenericoFavorites } from './genericoFavorites'
import { normalizeIngredientName, resolveProductForIngredient } from './ingredientMatch'

export type VoiceShoppingStatus = 'linked' | 'unlinked' | 'dismissed'

export interface VoiceShoppingItem {
  heardName: string
  key: string
  status: VoiceShoppingStatus
  product: Product | null
  buyAmount: number
}

export function heardShoppingKey(name: string): string {
  return normalizeIngredientName(name)
}

export function dismissHeardKey(dismissed: Iterable<string>, name: string): Set<string> {
  const next = new Set(
    [...dismissed].map(heardShoppingKey).filter(Boolean)
  )
  const key = heardShoppingKey(name)
  if (key) next.add(key)
  return next
}

export function classifyHeardShoppingNames(
  names: string[],
  products: Product[],
  opts?: {
    dismissedKeys?: Iterable<string>
    ignoreList?: string[]
    favorites?: GenericoFavorites
  }
): VoiceShoppingItem[] {
  const dismissed = new Set(
    [...(opts?.dismissedKeys ?? [])].map(heardShoppingKey).filter(Boolean)
  )
  const ignoreList = opts?.ignoreList ?? []
  const out: VoiceShoppingItem[] = []
  const seen = new Set<string>()

  for (const raw of names) {
    const heardName = raw.trim()
    const key = heardShoppingKey(heardName)
    if (!key || seen.has(key)) continue
    seen.add(key)

    if (dismissed.has(key)) {
      out.push({ heardName, key, status: 'dismissed', product: null, buyAmount: 1 })
      continue
    }

    const product = resolveProductForIngredient(heardName, products, opts?.favorites)
    if (product && !blockedAutoLink(heardName, product, ignoreList)) {
      out.push({
        heardName,
        key,
        status: 'linked',
        product,
        buyAmount: getBuyAmountFromDesc(product.description, product.id),
      })
      continue
    }

    out.push({ heardName, key, status: 'unlinked', product: null, buyAmount: 1 })
  }

  return out
}

/** Linked + undismissed unlinked — what actually goes on the list. */
export function voiceShoppingKeeps(items: VoiceShoppingItem[]): {
  linked: VoiceShoppingItem[]
  unlinked: VoiceShoppingItem[]
} {
  return {
    linked: items.filter((i) => i.status === 'linked' && i.product != null),
    unlinked: items.filter((i) => i.status === 'unlinked'),
  }
}

export function isLinkedShoppingProductId(productId: number | null | undefined): productId is number {
  return productId != null && productId > 0
}

export function shoppingItemLabel(
  item: Pick<ShoppingListItem, 'product_id' | 'note'>,
  productName: (id: number) => string
): string {
  if (isLinkedShoppingProductId(item.product_id)) return productName(item.product_id)
  const note = item.note?.trim()
  return note || 'Artigo'
}

export function alreadyOnShoppingList(
  item: VoiceShoppingItem,
  existing: ShoppingListItem[]
): boolean {
  const pending = existing.filter((row) => !row.done)
  if (item.status === 'linked' && item.product) {
    return pending.some((row) => row.product_id === item.product!.id)
  }
  if (item.status === 'unlinked') {
    return pending.some(
      (row) =>
        !isLinkedShoppingProductId(row.product_id) &&
        heardShoppingKey(row.note ?? '') === item.key
    )
  }
  return false
}

function blockedAutoLink(heard: string, product: Product, ignoreList: string[]): boolean {
  if (isReceiptNameIgnored(heard, ignoreList)) return true
  if (isReceiptNameIgnored(product.name, ignoreList)) return true
  const curto = cookingName(product.name, product.description)
  if (curto && isReceiptNameIgnored(curto, ignoreList)) return true
  const generico = getGenericoFromDesc(product.description)
  if (generico && isReceiptNameIgnored(generico, ignoreList)) return true
  return false
}
