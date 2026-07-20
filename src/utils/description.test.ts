import { describe, expect, it } from 'vitest'
import { parseDescription, parseSteps } from './parseDescription'
import { buildDescription, decrementPortions, addPortions, type IngredientRow } from './buildDescription'
import type { VerifiedField } from './verification'

const sampleRows: IngredientRow[] = [
  { id: 1, name: 'Atum', price: '1.50' },
  { id: 2, name: 'Esparguete', price: '0.80' },
]

describe('buildDescription + parseDescription round-trip', () => {
  it('preserves ingredients, steps, nutrition, price, category, and portions', () => {
    const built = buildDescription(
      sampleRows,
      'Cozer o esparguete.\nMisturar com o atum.',
      { calories: '450', protein: '30', carbs: '60', fat: '12' },
      '',
      2.3,
      'Completa',
      3
    )

    const parsed = parseDescription(built)

    expect(parsed.ingredientItems).toEqual([
      { name: 'Atum', price: 1.5 },
      { name: 'Esparguete', price: 0.8 },
    ])
    expect(parsed.steps).toBe('Cozer o esparguete.\nMisturar com o atum.')
    expect(parsed.nutrition).toEqual({ calories: 450, protein: 30, carbs: 60, fat: 12 })
    expect(parsed.price).toBe(2.3)
    expect(parsed.category).toBe('Completa')
    expect(parsed.portions).toBe(3)
    expect(parsed.verified).toEqual([])
    expect(parsed.origin).toBeNull()
  })

  it('stores meal origin and skips ingredients/steps for restaurant', () => {
    const built = buildDescription(
      sampleRows,
      'Não deve aparecer',
      { calories: '600', protein: '25', carbs: '50', fat: '20' },
      '8.50',
      0,
      'Completa',
      null,
      undefined,
      'restaurante',
      'Cantina do ISCTE'
    )
    const parsed = parseDescription(built)
    expect(parsed.origin).toBe('restaurante')
    expect(parsed.location).toBe('Cantina do ISCTE')
    expect(parsed.ingredientItems).toEqual([])
    expect(parsed.steps).toBeNull()
    expect(parsed.price).toBe(8.5)
  })

  it('round-trips supermercado origin', () => {
    const built = buildDescription(
      sampleRows,
      'Misturar',
      { calories: '400', protein: '20', carbs: '40', fat: '10' },
      '',
      2.3,
      'Ligeira',
      undefined,
      undefined,
      'supermercado'
    )
    expect(parseDescription(built).origin).toBe('supermercado')
  })

  it('round-trips verification flags', () => {
    const verified = new Set<VerifiedField>(['preco', 'nutricao'])
    const built = buildDescription(
      sampleRows,
      '',
      { calories: '400', protein: '20', carbs: '40', fat: '10' },
      '5.00',
      0,
      undefined,
      undefined,
      verified
    )
    expect(parseDescription(built).verified).toEqual(['nutricao', 'preco'])
  })

  it('treats unsectioned text as steps for legacy recipes', () => {
    const parsed = parseDescription('Passo um\nPasso dois')
    expect(parsed.steps).toBe('Passo um\nPasso dois')
    expect(parsed.ingredientItems).toEqual([])
    expect(parsed.verified).toEqual([])
  })
})

describe('portion helpers', () => {
  const withPortions = '[Ingredientes]\nAtum\n\n[Porcoes]\n3'

  it('decrements portions without going below zero', () => {
    expect(decrementPortions(withPortions)).toContain('[Porcoes]\n2')
    expect(decrementPortions('[Porcoes]\n0')).toContain('[Porcoes]\n0')
  })

  it('adds portions to existing section', () => {
    expect(addPortions(withPortions, 2)).toContain('[Porcoes]\n5')
  })

  it('creates portions section when missing', () => {
    const result = addPortions('[Passos]\nFerver', 2)
    expect(result).toContain('[Porcoes]\n2')
  })
})

describe('parseSteps', () => {
  it('splits steps on newlines and trims empty lines', () => {
    expect(parseSteps('Cozer pasta\n\nMisturar atum\n')).toEqual(['Cozer pasta', 'Misturar atum'])
    expect(parseSteps(null)).toEqual([])
  })

  it('splits numbered steps on one line', () => {
    expect(parseSteps('1. Cozer a massa. 2. Escorrer. 3. Misturar o atum.')).toEqual([
      'Cozer a massa.',
      'Escorrer.',
      'Misturar o atum.',
    ])
  })

  it('splits sentences when on a single line', () => {
    expect(parseSteps('Aquecer o azeite. Refogar a cebola. Juntar o atum.')).toEqual([
      'Aquecer o azeite',
      'Refogar a cebola',
      'Juntar o atum',
    ])
  })
})
