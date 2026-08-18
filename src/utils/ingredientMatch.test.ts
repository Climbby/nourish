import { describe, expect, it } from 'vitest'
import type { Product } from '../types/grocy'
import { buildDespensaDescription, ingredientDisplayName } from './despensaAnalytics'
import {
  displayNameForIngredient,
  findIngredientProductMatches,
  pickProductForIngredient,
  resolveProductForIngredient,
  variantChoiceLabel,
  variantChoicesForIngredient,
} from './ingredientMatch'
import { upsertMacrosSection, type ProductMacros } from './productNutrition'

function product(id: number, name: string, description: string | null): Product {
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

const macros: ProductMacros = {
  calories: 22,
  protein: 3,
  carbs: 1,
  fat: 0.3,
  fibre: 1,
  source: 'rotulo',
}

function completeDesc(extra: string): string {
  return upsertMacrosSection(
    `${extra}\n\n[BuyAmount]\n1\n\n[UnitGrams]\n185`,
    macros
  )
}

const mushrooms = [
  product(
    1,
    'COGUMELOS LAM CONTINENTE 250G',
    buildDespensaDescription(1, 1.9, { generico: 'Cogumelos', nomeCurto: 'Cogumelo' })
  ),
  product(
    2,
    'COGUMELOS AUCHAN 300G',
    buildDespensaDescription(1, 2.2, { generico: 'Cogumelos', nomeCurto: 'Cogumelo' })
  ),
]

describe('ingredientDisplayName', () => {
  it('prefers Generico, then NomeCurto, then the product name', () => {
    expect(
      ingredientDisplayName(
        'COGUMELOS LAM CONTINENTE 250G',
        buildDespensaDescription(1, 1, { generico: 'Cogumelos', nomeCurto: 'Cogumelo' })
      )
    ).toBe('Cogumelos')
    expect(
      ingredientDisplayName(
        'Atum Continente 120g',
        buildDespensaDescription(1, 1, { nomeCurto: 'Atum' })
      )
    ).toBe('Atum')
    expect(ingredientDisplayName('Sal', '[BuyAmount]\n1')).toBe('Sal')
  })
})

describe('displayNameForIngredient', () => {
  it('resolves a stored SKU name to Generico', () => {
    expect(displayNameForIngredient('COGUMELOS LAM CONTINENTE 250G', mushrooms)).toBe('Cogumelos')
  })

  it('resolves NomeCurto to Generico', () => {
    expect(displayNameForIngredient('Cogumelo', mushrooms)).toBe('Cogumelos')
  })

  it('keeps unmatched free text', () => {
    expect(displayNameForIngredient('Sal q.b.', mushrooms)).toBe('Sal q.b.')
  })
})

describe('resolveProductForIngredient', () => {
  it('matches a SKU to that exact product', () => {
    expect(resolveProductForIngredient('COGUMELOS AUCHAN 300G', mushrooms)?.id).toBe(2)
  })

  it('prefers the family favorite when resolving a Generico', () => {
    expect(resolveProductForIngredient('Cogumelos', mushrooms)?.id).toBe(1)
    expect(resolveProductForIngredient('Cogumelos', mushrooms, { cogumelos: 2 })?.id).toBe(2)
  })

  it('treats NomeCurto that equals Generico as a family match', () => {
    const family = [
      product(26, 'COGUMELOS DESP. CLASSICA 185G', '[Generico]\nCogumelos'),
      product(
        42,
        'COGUMELOS LAMINADOS CNT 185GR',
        '[NomeCurto]\nCogumelos\n\n[Generico]\nCogumelos'
      ),
    ]
    expect(findIngredientProductMatches('Cogumelos', family).map((p) => p.id)).toEqual([26, 42])
  })

  it('picks the only complete variant without asking', () => {
    const classic = product(26, 'COGUMELOS DESP. CLASSICA 185G', '[Generico]\nCogumelos')
    const laminados = product(
      42,
      'COGUMELOS LAMINADOS CNT 185GR',
      completeDesc('[NomeCurto]\nCogumelos\n\n[Generico]\nCogumelos')
    )
    expect(resolveProductForIngredient('Cogumelos', [classic, laminados])?.id).toBe(42)
    expect(variantChoicesForIngredient('Cogumelos', [classic, laminados])).toEqual([])
  })

  it('picks the in-stock SKU even if another variant is complete', () => {
    const classic = product(26, 'COGUMELOS DESP. CLASSICA 185G', '[Generico]\nCogumelos')
    const laminados = product(
      42,
      'COGUMELOS LAMINADOS CNT 185GR',
      completeDesc('[NomeCurto]\nCogumelos\n\n[Generico]\nCogumelos')
    )
    expect(
      resolveProductForIngredient('Cogumelos', [classic, laminados], undefined, { 26: 1 })?.id
    ).toBe(26)
    expect(
      variantChoicesForIngredient('Cogumelos', [classic, laminados], { 26: 1 })
    ).toEqual([])
  })

  it('uses the starred favorite even when another SKU has more stock', () => {
    const classic = product(
      26,
      'COGUMELOS DESP. CLASSICA 185G',
      completeDesc('[Generico]\nCogumelos')
    )
    const laminados = product(
      42,
      'COGUMELOS LAMINADOS CNT 185GR',
      completeDesc('[Generico]\nCogumelos')
    )
    expect(
      resolveProductForIngredient('Cogumelos', [classic, laminados], { cogumelos: 26 }, {
        26: 1,
        42: 3,
      })?.id
    ).toBe(26)
  })
})

describe('pickProductForIngredient', () => {
  it('asks to pick a favorite when two complete variants conflict', () => {
    const classic = product(
      26,
      'COGUMELOS DESP. CLASSICA 185G',
      completeDesc('[Generico]\nCogumelos')
    )
    const laminados = product(
      42,
      'COGUMELOS LAMINADOS CNT 185GR',
      completeDesc('[Generico]\nCogumelos')
    )
    const pick = pickProductForIngredient([classic, laminados])
    expect(pick.needsChoice.map((p) => p.id)).toEqual([26, 42])
  })

  it('does not ask once a favorite is set', () => {
    const classic = product(
      26,
      'COGUMELOS DESP. CLASSICA 185G',
      completeDesc('[Generico]\nCogumelos')
    )
    const laminados = product(
      42,
      'COGUMELOS LAMINADOS CNT 185GR',
      completeDesc('[Generico]\nCogumelos')
    )
    const pick = pickProductForIngredient([classic, laminados], { favorites: { cogumelos: 42 } })
    expect(pick.product?.id).toBe(42)
    expect(pick.needsChoice).toEqual([])
  })

  it('asks when two packs are in stock and none is starred', () => {
    const six = product(1, 'OVOS 6UN', completeDesc('[Generico]\nOvos'))
    const twelve = product(2, 'OVOS 12UN', completeDesc('[Generico]\nOvos'))
    const pick = pickProductForIngredient([six, twelve], { stockByProduct: { 1: 1, 2: 1 } })
    expect(pick.needsChoice.map((p) => p.id)).toEqual([1, 2])
  })

  it('does not ask for an exact SKU name', () => {
    const classic = product(
      26,
      'COGUMELOS DESP. CLASSICA 185G',
      completeDesc('[Generico]\nCogumelos')
    )
    const laminados = product(
      42,
      'COGUMELOS LAMINADOS CNT 185GR',
      completeDesc('[Generico]\nCogumelos')
    )
    expect(
      variantChoicesForIngredient('COGUMELOS DESP. CLASSICA 185G', [classic, laminados])
    ).toEqual([])
  })
})

describe('variantChoiceLabel', () => {
  it('strips the Generico word from the SKU', () => {
    expect(
      variantChoiceLabel(
        product(26, 'COGUMELOS DESP. CLASSICA 185G', '[Generico]\nCogumelos')
      )
    ).toBe('DESP. CLASSICA 185G')
    expect(
      variantChoiceLabel(
        product(42, 'COGUMELOS LAMINADOS CNT 185GR', '[Generico]\nCogumelos')
      )
    ).toBe('LAMINADOS CNT 185GR')
  })
})
