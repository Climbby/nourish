import { grocy } from '../api/grocy'
import { grocyConfig } from '../config/grocy'
import type { Product, RecipeIngredient } from '../types/grocy'
import { repointAliases } from '../features/receipt/receiptAliases'
import {
  buildDespensaDescription,
  getBuyAmountFromDesc,
  getDespensaCatFromDesc,
  getGenericoFromDesc,
  getNomeCurtoFromDesc,
  getPriceFromDesc,
  getPriceUnitFromDesc,
  getStoreFromDesc,
  getUnitGramsFromDesc,
} from './despensaAnalytics'
import { parseVerifiedFields } from './verification'

export interface MergeProductsResult {
  canonicalId: number
  duplicateId: number
  stockTransferred: number
  recipesRepointed: number
  recipesWarned: number
}

async function fetchIngredientsForProduct(productId: number): Promise<RecipeIngredient[]> {
  const params = new URLSearchParams()
  params.append('query[]', `product_id=${productId}`)
  const res = await fetch(`/api/objects/recipes_pos?${params.toString()}`)
  if (!res.ok) throw new Error(`recipes_pos: ${res.status}`)
  return res.json()
}

/**
 * Merge `duplicateId` into `canonicalId`: transfer stock, repoint aliases + recipe
 * ingredients, then deactivate the duplicate.
 */
export async function mergeProducts(
  canonicalId: number,
  duplicateId: number
): Promise<MergeProductsResult> {
  if (canonicalId === duplicateId) throw new Error('Escolhe um produto diferente')

  const [canonical, duplicate] = await Promise.all([
    grocy.getProduct(canonicalId),
    grocy.getProduct(duplicateId),
  ])

  const [canonStock, dupStock] = await Promise.all([
    grocy.getProductStockAmount(canonicalId),
    grocy.getProductStockAmount(duplicateId),
  ])

  const transfer = dupStock.amount
  if (transfer > 0) {
    await grocy.addStock(canonicalId, transfer, {
      note: `Fusão: de ${duplicate.name}`,
    })
    await grocy.consumeStock(duplicateId, transfer)
  }

  // Prefer non-empty category / price / store / cooking meta from either product
  const cat =
    getDespensaCatFromDesc(canonical.description) ?? getDespensaCatFromDesc(duplicate.description)
  const generico =
    getGenericoFromDesc(canonical.description) ?? getGenericoFromDesc(duplicate.description)
  const price = getPriceFromDesc(canonical.description) ?? getPriceFromDesc(duplicate.description)
  const store = getStoreFromDesc(canonical.description) ?? getStoreFromDesc(duplicate.description)
  const nomeCurto =
    getNomeCurtoFromDesc(canonical.description) ?? getNomeCurtoFromDesc(duplicate.description)
  const unitGrams =
    getUnitGramsFromDesc(canonical.description) ?? getUnitGramsFromDesc(duplicate.description)
  const buyAmount = Math.max(
    getBuyAmountFromDesc(canonical.description, canonicalId),
    getBuyAmountFromDesc(duplicate.description, duplicateId)
  )
  const verified = parseVerifiedFields(canonical.description)
  for (const f of parseVerifiedFields(duplicate.description)) verified.add(f)
  await grocy.updateProduct(canonicalId, {
    description: buildDespensaDescription(buyAmount, price, {
      verified,
      storeLabel: store,
      existingDescription: canonical.description,
      priceUnit: getPriceUnitFromDesc(canonical.description) || getPriceUnitFromDesc(duplicate.description),
      despensaCat: cat,
      generico,
      nomeCurto,
      unitGrams,
    }),
  })

  repointAliases(duplicateId, canonicalId)

  let recipesRepointed = 0
  let recipesWarned = 0
  try {
    const ingredients = await fetchIngredientsForProduct(duplicateId)
    for (const ing of ingredients) {
      try {
        await fetch(`/api/objects/recipes_pos/${ing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...ing, product_id: canonicalId }),
        })
        recipesRepointed++
      } catch {
        recipesWarned++
      }
    }
  } catch {
    recipesWarned++
  }

  try {
    await grocy.updateProduct(duplicateId, { active: 0 })
  } catch {
    await grocy.deleteProduct(duplicateId)
  }

  return {
    canonicalId,
    duplicateId,
    stockTransferred: transfer,
    recipesRepointed,
    recipesWarned,
  }
}

export async function listDespensaProductsForMerge(excludeId: number): Promise<Product[]> {
  const all = await grocy.getProducts()
  return all
    .filter(
      (p) =>
        p.id !== excludeId &&
        p.product_group_id === grocyConfig.despensaGroupId &&
        (p.active ?? 1) === 1
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
}
