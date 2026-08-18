import { describe, expect, it } from 'vitest'
import type { Product } from '../types/grocy'
import {
  applyIngredientName,
  canUseUnitCount,
  costForQuantity,
  filterProductsForIngredient,
  gramsForQuantity,
  gramsFromUnitCount,
  hydrateIngredientFromProducts,
  inferUnitGramsFromName,
  patchIngredientAmount,
  patchIngredientAmountMode,
  qtyFromGrams,
  resolveIngredientFromProduct,
  resolveUnitGrams,
} from './ingredientFromProduct'
import { upsertMacrosSection } from './productNutrition'

function product(id: number, name: string, description: string): Product {
  return {
    id,
    name,
    description,
    product_group_id: 6,
    qu_id_stock: 1,
    qu_id_purchase: 1,
    picture_file_name: null,
    calories: null,
    active: 1,
  }
}

describe('gramsForQuantity / costForQuantity', () => {
  const lata =
    '[BuyAmount]\n1\n\n[Preco]\n1.20\n\n[UnitGrams]\n120\n\n[NomeCurto]\nAtum'

  it('converts count to grams', () => {
    expect(gramsForQuantity(lata, 2)).toBe(240)
    expect(gramsForQuantity('[BuyAmount]\n1', 2)).toBeNull()
  })

  it('converts grams back to unit count', () => {
    expect(qtyFromGrams(240, 120)).toBe(2)
    expect(qtyFromGrams(180, 120)).toBe(1.5)
    expect(gramsFromUnitCount(2, 120)).toBe(240)
    expect(canUseUnitCount(120)).toBe(true)
    expect(canUseUnitCount(null)).toBe(false)
  })

  it('costs pack price per unit for un products', () => {
    const pack =
      '[BuyAmount]\n6\n\n[Preco]\n1.80\n\n[UnitGrams]\n55\n\n[NomeCurto]\nOvo'
    // 2 eggs of a 6-pack at €1.80 → 0.60
    expect(costForQuantity(pack, 2)).toBe(0.6)
  })

  it('costs by weight for kg products', () => {
    const tomato =
      '[BuyAmount]\n1\n\n[Preco]\n2.00\n\n[PrecoUnit]\nkg\n\n[UnitGrams]\n150'
    // 1 tomato × 150 g × €2/kg → 0.30
    expect(costForQuantity(tomato, 1)).toBe(0.3)
  })
})

describe('resolveIngredientFromProduct', () => {
  it('fills family name, price and grams from count', () => {
    const p = product(
      3,
      'Atum Continente natural 120g',
      '[BuyAmount]\n1\n\n[Preco]\n1.20\n\n[UnitGrams]\n120\n\n[NomeCurto]\nAtum\n\n[Generico]\nAtum'
    )
    expect(resolveIngredientFromProduct(p, 2)).toEqual({
      name: 'Atum',
      price: '2.40',
      grams: '240',
      qty: '2',
      productId: 3,
      unitGrams: 120,
    })
  })

  it('stores Generico rather than the SKU when both exist', () => {
    const p = product(
      4,
      'COGUMELOS LAM CONTINENTE 250G',
      '[BuyAmount]\n1\n\n[Preco]\n1.90\n\n[UnitGrams]\n250\n\n[NomeCurto]\nCogumelo\n\n[Generico]\nCogumelos'
    )
    expect(resolveIngredientFromProduct(p, 1).name).toBe('Cogumelos')
  })
})

describe('filterProductsForIngredient', () => {
  const products = [
    product(1, 'Atum Continente 120g', '[BuyAmount]\n1\n\n[NomeCurto]\nAtum'),
    product(2, 'Ovos classe M', '[BuyAmount]\n6\n\n[NomeCurto]\nOvo'),
    product(
      3,
      'COGUMELOS LAM CONTINENTE',
      '[BuyAmount]\n1\n\n[NomeCurto]\nCogumelo\n\n[Generico]\nCogumelos'
    ),
    product(
      4,
      'COGUMELOS AUCHAN',
      '[BuyAmount]\n1\n\n[NomeCurto]\nCogumelo\n\n[Generico]\nCogumelos'
    ),
  ]

  it('matches NomeCurto and full name', () => {
    expect(filterProductsForIngredient('atu', products).map((p) => p.id)).toEqual([1])
    expect(filterProductsForIngredient('ovos', products).map((p) => p.id)).toEqual([2])
  })

  it('matches Generico and lists the favorite first', () => {
    expect(filterProductsForIngredient('cogumelos', products).map((p) => p.id)).toEqual([4, 3])
    expect(
      filterProductsForIngredient('cogumelos', products, 8, { cogumelos: 3 }).map((p) => p.id)
    ).toEqual([3, 4])
  })
})

describe('hydrateIngredientFromProducts', () => {
  it('relinks by NomeCurto and infers qty from grams', () => {
    const products = [
      product(
        1,
        'Atum Continente 120g',
        '[BuyAmount]\n1\n\n[UnitGrams]\n120\n\n[NomeCurto]\nAtum'
      ),
    ]
    expect(hydrateIngredientFromProducts('Atum', 240, products)).toEqual({
      name: 'Atum',
      productId: 1,
      unitGrams: 120,
      qty: '2',
      grams: 240,
    })
  })

  it('relinks a SKU name and displays Generico', () => {
    const products = [
      product(
        1,
        'COGUMELOS LAM CONTINENTE',
        '[BuyAmount]\n1\n\n[UnitGrams]\n250\n\n[NomeCurto]\nCogumelo\n\n[Generico]\nCogumelos'
      ),
    ]
    expect(hydrateIngredientFromProducts('COGUMELOS LAM CONTINENTE', 250, products)).toEqual({
      name: 'Cogumelos',
      productId: 1,
      unitGrams: 250,
      qty: '1',
      grams: 250,
    })
  })

  it('prefers the favorite SKU when hydrating a Generico', () => {
    const products = [
      product(
        1,
        'COGUMELOS LAM CONTINENTE',
        '[BuyAmount]\n1\n\n[UnitGrams]\n250\n\n[Generico]\nCogumelos'
      ),
      product(
        2,
        'COGUMELOS AUCHAN',
        '[BuyAmount]\n1\n\n[UnitGrams]\n300\n\n[Generico]\nCogumelos'
      ),
    ]
    expect(hydrateIngredientFromProducts('Cogumelos', 300, products, { cogumelos: 2 })).toEqual({
      name: 'Cogumelos',
      productId: 2,
      unitGrams: 300,
      qty: '1',
      grams: 300,
    })
  })
})

describe('patchIngredientAmount', () => {
  const p = product(
    3,
    'Atum Continente natural 120g',
    '[BuyAmount]\n1\n\n[Preco]\n1.20\n\n[UnitGrams]\n120\n\n[NomeCurto]\nAtum\n\n[Generico]\nAtum'
  )
  const row = {
    id: 1,
    name: 'Atum',
    price: '1.20',
    grams: '120',
    qty: '1',
    productId: 3,
    unitGrams: 120,
    amountMode: 'un' as const,
  }

  it('updates grams and price from unit count', () => {
    expect(patchIngredientAmount(row, 'qty', '2', [p])).toMatchObject({
      qty: '2',
      grams: '240',
      price: '2.40',
    })
  })

  it('updates unit count and price from grams', () => {
    expect(patchIngredientAmount({ ...row, amountMode: 'g' }, 'grams', '240', [p])).toMatchObject({
      grams: '240',
      qty: '2',
      price: '2.40',
    })
  })

  it('keeps grams when counting units of a product without UnitGrams', () => {
    const noGrams = product(9, 'Sal', '[BuyAmount]\n1\n\n[Preco]\n0.40')
    const salted = {
      id: 1,
      name: 'Sal',
      price: '',
      grams: '5',
      qty: '1',
      productId: 9,
      unitGrams: null,
      amountMode: 'un' as const,
    }
    expect(patchIngredientAmount(salted, 'qty', '2', [noGrams])).toMatchObject({
      qty: '2',
      grams: '5',
      price: '0.80',
    })
  })
})

describe('applyIngredientName', () => {
  const p = product(
    3,
    'Atum Continente natural 120g',
    '[BuyAmount]\n1\n\n[Preco]\n1.20\n\n[UnitGrams]\n120\n\n[NomeCurto]\nAtum\n\n[Generico]\nAtum'
  )
  const blank = { id: 1, name: '', price: '' }

  it('links an exact NomeCurto and fills qty/grams/price', () => {
    expect(applyIngredientName(blank, 'atum', [p])).toMatchObject({
      name: 'atum',
      productId: 3,
      unitGrams: 120,
      qty: '1',
      grams: '120',
      price: '1.20',
    })
  })

  it('commits the family display name on blur', () => {
    expect(applyIngredientName(blank, 'atum', [p], undefined, { commitName: true }).name).toBe(
      'Atum'
    )
  })

  it('keeps already-entered grams and infers qty', () => {
    expect(applyIngredientName({ ...blank, grams: '240', price: '3.00' }, 'Atum', [p])).toMatchObject({
      productId: 3,
      grams: '240',
      qty: '2',
      price: '3.00',
    })
  })

  it('unlinks when the name no longer matches', () => {
    const linked = applyIngredientName(blank, 'Atum', [p])
    expect(applyIngredientName(linked, 'alho', [p])).toMatchObject({
      name: 'alho',
      productId: undefined,
      unitGrams: undefined,
    })
  })

  it('keeps a manually picked sibling instead of snapping back to the favorite', () => {
    const classic = product(
      26,
      'COGUMELOS DESP. CLASSICA 185G',
      '[BuyAmount]\n1\n\n[UnitGrams]\n185\n\n[Generico]\nCogumelos'
    )
    const laminados = product(
      42,
      'COGUMELOS LAMINADOS CNT 185GR',
      '[BuyAmount]\n1\n\n[UnitGrams]\n185\n\n[Generico]\nCogumelos'
    )
    const row = { id: 1, name: 'Cogumelos', price: '', productId: 26 }
    expect(
      applyIngredientName(row, 'Cogumelos', [classic, laminados], { cogumelos: 42 })
    ).toMatchObject({ productId: 26 })
  })
})

describe('patchIngredientAmountMode', () => {
  it('switches to units without UnitGrams and keeps grams', () => {
    const row = { id: 1, name: 'Sal', price: '', grams: '5', amountMode: 'g' as const }
    expect(patchIngredientAmountMode(row, 'un')).toMatchObject({
      amountMode: 'un',
      grams: '5',
    })
  })

  it('infers qty from grams when UnitGrams is known', () => {
    const row = {
      id: 1,
      name: 'Atum',
      price: '1.20',
      grams: '240',
      productId: 3,
      unitGrams: 120,
      amountMode: 'g' as const,
    }
    expect(patchIngredientAmountMode(row, 'un')).toMatchObject({
      amountMode: 'un',
      qty: '2',
    })
  })

  it('treats a tiny stored gram value as a unit count', () => {
    const row = {
      id: 1,
      name: 'Cogumelos',
      price: '1.09',
      grams: '1',
      productId: 26,
      unitGrams: 185,
      amountMode: 'g' as const,
    }
    expect(patchIngredientAmountMode(row, 'un')).toMatchObject({
      amountMode: 'un',
      qty: '1',
      grams: '185',
    })
  })
})

describe('resolveUnitGrams', () => {
  it('reads trailing pack weight from the SKU name', () => {
    expect(inferUnitGramsFromName('COGUMELOS LAMINADOS CNT 185GR')).toBe(185)
    expect(inferUnitGramsFromName('COGUMELOS DESP. CLASSICA 185G')).toBe(185)
    expect(inferUnitGramsFromName('COGUMELOS LAM 250G CNT')).toBe(250)
    expect(inferUnitGramsFromName('HAMBURGUER PORCO CNT 10x50G')).toBeNull()
  })

  it('falls back to a Generico sibling when the linked SKU has no g/un', () => {
    const classic = product(26, 'COGUMELOS DESP. CLASSICA', '[Generico]\nCogumelos')
    const laminados = product(
      42,
      'COGUMELOS LAMINADOS CNT 185GR',
      '[BuyAmount]\n1\n\n[UnitGrams]\n185\n\n[Generico]\nCogumelos'
    )
    expect(resolveUnitGrams(classic, [classic, laminados])).toBe(185)
  })

  it('repairs 1 g of mushrooms into 1 pack of the only complete variant', () => {
    const classic = product(26, 'COGUMELOS DESP. CLASSICA 185G', '[Generico]\nCogumelos')
    const laminados = product(
      42,
      'COGUMELOS LAMINADOS CNT 185GR',
      upsertMacrosSection(
        '[NomeCurto]\nCogumelos\n\n[Generico]\nCogumelos\n\n[BuyAmount]\n1\n\n[UnitGrams]\n185',
        {
          calories: 22,
          protein: 3,
          carbs: 1,
          fat: 0.3,
          fibre: 1,
          source: 'rotulo',
        }
      )
    )
    expect(hydrateIngredientFromProducts('Cogumelos', 1, [classic, laminados])).toMatchObject({
      productId: 42,
      unitGrams: 185,
      qty: '1',
      grams: 185,
    })
  })

  it('hydrates the in-stock SKU even when a sibling is the complete one', () => {
    const classic = product(26, 'COGUMELOS DESP. CLASSICA 185G', '[Generico]\nCogumelos')
    const laminados = product(
      42,
      'COGUMELOS LAMINADOS CNT 185GR',
      upsertMacrosSection(
        '[NomeCurto]\nCogumelos\n\n[Generico]\nCogumelos\n\n[BuyAmount]\n1\n\n[UnitGrams]\n185',
        {
          calories: 22,
          protein: 3,
          carbs: 1,
          fat: 0.3,
          fibre: 1,
          source: 'rotulo',
        }
      )
    )
    expect(
      hydrateIngredientFromProducts('Cogumelos', 1, [classic, laminados], undefined, { 26: 1 })
    ).toMatchObject({
      productId: 26,
      unitGrams: 185,
      qty: '1',
      grams: 185,
    })
  })
})
