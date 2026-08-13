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
    const built = buildDescription({
      ingredientRows: sampleRows,
      steps: 'Cozer o esparguete.\nMisturar com o atum.',
      nutrition: { calories: '450', protein: '30', carbs: '60', fat: '12' },
      priceOverride: '',
      autoTotal: 2.3,
      category: 'Completa',
      portions: 3,
    })

    const parsed = parseDescription(built)

    expect(parsed.ingredientItems).toEqual([
      { name: 'Atum', price: 1.5, grams: null },
      { name: 'Esparguete', price: 0.8, grams: null },
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
    const built = buildDescription({
      ingredientRows: sampleRows,
      steps: 'Não deve aparecer',
      nutrition: { calories: '600', protein: '25', carbs: '50', fat: '20' },
      priceOverride: '8.50',
      autoTotal: 0,
      category: 'Completa',
      portions: null,
      origin: 'restaurante',
      location: 'Cantina do ISCTE',
    })
    const parsed = parseDescription(built)
    expect(parsed.origin).toBe('restaurante')
    expect(parsed.location).toBe('Cantina do ISCTE')
    expect(parsed.locationCoords).toBeNull()
    expect(parsed.ingredientItems).toEqual([])
    expect(parsed.steps).toBeNull()
    expect(parsed.price).toBe(8.5)
  })

  it('round-trips locality label and coords', () => {
    const built = buildDescription({
      ingredientRows: [],
      steps: '',
      nutrition: { calories: '', protein: '', carbs: '', fat: '' },
      priceOverride: '12.00',
      autoTotal: 0,
      category: 'Completa',
      portions: null,
      origin: 'restaurante',
      location: 'Condeixa, Coimbra',
      locationCoords: { latitude: 40.114, longitude: -8.499 },
    })
    const parsed = parseDescription(built)
    expect(parsed.location).toBe('Condeixa, Coimbra')
    expect(parsed.locationCoords).toEqual({ latitude: 40.114, longitude: -8.499 })
  })

  it('round-trips supermercado origin', () => {
    const built = buildDescription({
      ingredientRows: sampleRows,
      steps: 'Misturar',
      nutrition: { calories: '400', protein: '20', carbs: '40', fat: '10' },
      priceOverride: '',
      autoTotal: 2.3,
      category: 'Ligeira',
      origin: 'supermercado',
    })
    expect(parseDescription(built).origin).toBe('supermercado')
  })

  it('round-trips verification flags', () => {
    const verified = new Set<VerifiedField>(['preco', 'nutricao'])
    const built = buildDescription({
      ingredientRows: sampleRows,
      steps: '',
      nutrition: { calories: '400', protein: '20', carbs: '40', fat: '10' },
      priceOverride: '5.00',
      autoTotal: 0,
      verified,
    })
    expect(parseDescription(built).verified).toEqual(['nutricao', 'preco'])
  })

  it('round-trips cook time and notes', () => {
    const built = buildDescription({
      ingredientRows: sampleRows,
      steps: 'Misturar',
      nutrition: { calories: '', protein: '', carbs: '', fat: '' },
      priceOverride: '',
      autoTotal: 2.3,
      timeMinutes: '25',
      notes: 'Menos sal.\n20 min chegam.',
    })
    const parsed = parseDescription(built)
    expect(parsed.timeMinutes).toBe(25)
    expect(parsed.notes).toBe('Menos sal.\n20 min chegam.')
  })

  it('omits time and notes when empty', () => {
    const built = buildDescription({
      ingredientRows: sampleRows,
      steps: '',
      nutrition: { calories: '', protein: '', carbs: '', fat: '' },
      priceOverride: '',
      autoTotal: 0,
      timeMinutes: '',
      notes: '   ',
    })
    expect(built).not.toContain('[Tempo]')
    expect(built).not.toContain('[Notas]')
    const parsed = parseDescription(built)
    expect(parsed.timeMinutes).toBeNull()
    expect(parsed.notes).toBeNull()
  })
})

describe('ingredient quantities', () => {
  it('round-trips name, price, and grams', () => {
    const built = buildDescription({
      ingredientRows: [
        { id: 1, name: 'Atum', price: '1.50', grams: '80' },
        { id: 2, name: 'Esparguete', price: '0.80', grams: '250' },
      ],
      steps: '',
      nutrition: { calories: '', protein: '', carbs: '', fat: '' },
      priceOverride: '',
      autoTotal: 2.3,
    })
    expect(parseDescription(built).ingredientItems).toEqual([
      { name: 'Atum', price: 1.5, grams: 80 },
      { name: 'Esparguete', price: 0.8, grams: 250 },
    ])
  })

  it('stores grams when the price is missing', () => {
    const built = buildDescription({
      ingredientRows: [{ id: 1, name: 'Espinafres', price: '', grams: '150' }],
      steps: '',
      nutrition: { calories: '', protein: '', carbs: '', fat: '' },
      priceOverride: '',
      autoTotal: 0,
    })
    expect(built).toContain('Espinafres||150')
    expect(parseDescription(built).ingredientItems).toEqual([
      { name: 'Espinafres', price: null, grams: 150 },
    ])
  })

  it('still parses legacy two-field and bare lines', () => {
    const parsed = parseDescription('[Ingredientes]\nAtum|1.50\nSal')
    expect(parsed.ingredientItems).toEqual([
      { name: 'Atum', price: 1.5, grams: null },
      { name: 'Sal', price: null, grams: null },
    ])
  })

  it('does not mistake a pipe in the name for a quantity', () => {
    const parsed = parseDescription('[Ingredientes]\nArroz|Massa|1.50')
    expect(parsed.ingredientItems).toEqual([
      { name: 'Arroz|Massa', price: 1.5, grams: null },
    ])
  })
})

describe('legacy recipes', () => {
  it('treats unsectioned text as steps', () => {
    const parsed = parseDescription('Passo um\nPasso dois')
    expect(parsed.steps).toBe('Passo um\nPasso dois')
    expect(parsed.ingredientItems).toEqual([])
    expect(parsed.verified).toEqual([])
    expect(parsed.timeMinutes).toBeNull()
    expect(parsed.notes).toBeNull()
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
