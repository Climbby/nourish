import { describe, expect, it } from 'vitest'
import { buildDespensaDescription } from './despensaAnalytics'
import type { IngredientRow } from './buildDescription'
import type { Product } from '../types/grocy'
import {
  collectIngredientSuggestions,
  findIngredientStepMismatch,
  matchExtractedNamesToPantry,
  mergeSuggestedIngredientRows,
  suggestIngredientsFromSteps,
} from './ingredientSteps'

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

const pantry = [
  product(
    1,
    'Atum Continente natural 120g',
    buildDespensaDescription(1, 1.2, {
      unitGrams: 120,
      nomeCurto: 'Atum',
      generico: 'Atum',
    })
  ),
  product(
    2,
    'Esparguete Milaneza 500g',
    buildDespensaDescription(1, 0.8, { nomeCurto: 'Esparguete', generico: 'Esparguete' })
  ),
  product(
    3,
    'COGUMELOS LAM CONTINENTE',
    buildDespensaDescription(1, 1.9, { unitGrams: 250, nomeCurto: 'Cogumelo', generico: 'Cogumelos' })
  ),
  product(
    4,
    'Ovos classe M',
    buildDespensaDescription(6, 1.8, { unitGrams: 55, nomeCurto: 'Ovo', generico: 'Ovos' })
  ),
  product(5, 'Salsa em ramo', buildDespensaDescription(1, 0.5, { nomeCurto: 'Salsa' })),
]

describe('suggestIngredientsFromSteps', () => {
  it('matches Generico, NomeCurto and product name as whole phrases', () => {
    const steps =
      'Ferver o esparguete. Escorrer o atum. Saltear os cogumelos. Juntar 2 ovos.'
    const found = suggestIngredientsFromSteps(steps, pantry, [])
    expect(found.map((s) => s.displayName).sort()).toEqual(
      ['Atum', 'Cogumelos', 'Esparguete', 'Ovos'].sort()
    )
  })

  it('does not fuzzy-match sal inside salsa', () => {
    const sal = product(9, 'Sal fino', buildDespensaDescription(1, 0.3, { nomeCurto: 'Sal', generico: 'Sal' }))
    const found = suggestIngredientsFromSteps('Picar a salsa e juntar no fim.', [...pantry, sal], [])
    expect(found.map((s) => s.displayName)).toEqual(['Salsa'])
  })

  it('skips names already on the ingredient list', () => {
    const found = suggestIngredientsFromSteps(
      'Ferver o esparguete e juntar o atum.',
      pantry,
      ['Atum']
    )
    expect(found.map((s) => s.displayName)).toEqual(['Esparguete'])
  })

  it('does not match a pantry name that is only a substring of another word', () => {
    const found = suggestIngredientsFromSteps('Naturalmente deixa assentar.', pantry, [])
    expect(found).toEqual([])
  })
})

describe('matchExtractedNamesToPantry', () => {
  it('exact-matches AI names onto Despensa products', () => {
    const found = matchExtractedNamesToPantry(['atum', 'massa'], pantry, [])
    expect(found).toEqual([
      { displayName: 'Atum', product: pantry[0] },
      { displayName: 'massa', product: null },
    ])
  })
})

describe('collectIngredientSuggestions', () => {
  it('skips AI when the local pantry scan already found matches', async () => {
    let aiCalls = 0
    const found = await collectIngredientSuggestions(
      'Ferver o esparguete.',
      pantry,
      [],
      undefined,
      async () => {
        aiCalls += 1
        return ['atum']
      }
    )
    expect(aiCalls).toBe(0)
    expect(found.map((s) => s.displayName)).toEqual(['Esparguete'])
  })

  it('falls back to AI extract when the local scan finds nothing', async () => {
    const found = await collectIngredientSuggestions(
      'Aquecer o forno e preparar a mistura.',
      pantry,
      [],
      undefined,
      async () => ['atum', 'massa']
    )
    expect(found.map((s) => s.displayName)).toEqual(['Atum', 'massa'])
  })
})

describe('findIngredientStepMismatch', () => {
  it('does not nag when passos are still empty', () => {
    expect(findIngredientStepMismatch(['Atum', 'Esparguete'], '', pantry)).toEqual({
      unusedIngredients: [],
      extraInSteps: [],
    })
  })

  it('lists unused ingredients by Generico when they are missing from passos', () => {
    const mismatch = findIngredientStepMismatch(
      ['Atum', 'Esparguete'],
      'Ferver a água e cozer o esparguete.',
      pantry
    )
    expect(mismatch.unusedIngredients).toEqual(['Atum'])
    expect(mismatch.extraInSteps).toEqual([])
  })

  it('treats NomeCurto / Generico aliases as mentioned', () => {
    const mismatch = findIngredientStepMismatch(
      ['COGUMELOS LAM CONTINENTE'],
      'Saltear os cogumelos em azeite.',
      pantry
    )
    expect(mismatch.unusedIngredients).toEqual([])
  })

  it('flags pantry items mentioned in passos but missing from the list', () => {
    const mismatch = findIngredientStepMismatch(
      ['Esparguete'],
      'Cozer o esparguete e juntar o atum.',
      pantry
    )
    expect(mismatch.unusedIngredients).toEqual([])
    expect(mismatch.extraInSteps).toEqual(['Atum'])
  })
})

describe('mergeSuggestedIngredientRows', () => {
  it('fills empty rows then appends, without overwriting named rows', () => {
    let nextId = 10
    const rows: IngredientRow[] = [
      { id: 1, name: 'Atum', price: '1.20' },
      { id: 2, name: '', price: '' },
    ]
    const merged = mergeSuggestedIngredientRows(
      rows,
      [
        { displayName: 'Atum', product: pantry[0] },
        { displayName: 'Esparguete', product: pantry[1] },
        { displayName: 'Ovos', product: pantry[3] },
      ],
      () => nextId++
    )
    expect(merged.map((r) => r.name)).toEqual(['Atum', 'Esparguete', 'Ovos'])
    expect(merged[0].price).toBe('1.20')
    expect(merged[0].id).toBe(1)
  })
})
