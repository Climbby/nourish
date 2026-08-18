import { describe, expect, it } from 'vitest'
import {
  applyInsaFood,
  applyInsaSource,
  insaLookupNames,
  insaMissingMessage,
  listInsaFoods,
  lookupInsaMacros,
  searchInsaFoods,
} from './insaNutrition'
import { getMacrosFromDesc, upsertMacrosSection } from './productNutrition'

describe('lookupInsaMacros', () => {
  it('matches cooking names ignoring case and accents', () => {
    const egg = lookupInsaMacros(['Ovos'])
    expect(egg?.foodName).toBe('Ovo')
    expect(egg?.macros).toEqual({
      calories: 149,
      protein: 12.5,
      carbs: 0.7,
      fat: 10.3,
      fibre: 0,
      source: 'insa',
    })

    expect(lookupInsaMacros(['CEBOLA'])?.foodName).toBe('Cebola')
    expect(lookupInsaMacros(['tomáte'])?.foodName).toBe('Tomate')
    expect(lookupInsaMacros(['Alho'])?.macros.calories).toBe(111)
  })

  it('matches hyphenated aliases to the spaced form', () => {
    expect(lookupInsaMacros(['batata-doce'])?.foodName).toBe('Batata-doce')
    expect(lookupInsaMacros(['alho-francês'])?.foodName).toBe('Alho-francês')
  })

  it('uses the first matching candidate (NomeCurto / Generico before SKU)', () => {
    const match = lookupInsaMacros(['Ovo', 'Ovos Classe M Continente'])
    expect(match?.foodName).toBe('Ovo')
    expect(match?.macros.source).toBe('insa')
  })

  it('does not fuzzy-match a different food', () => {
    expect(lookupInsaMacros(['Ovos classe M Continente'])).toBeNull()
    expect(lookupInsaMacros(['molho de tomate'])).toBeNull()
    expect(lookupInsaMacros(['batata frita'])).toBeNull()
    expect(lookupInsaMacros(['atum'])).toBeNull()
  })

  it('does not confuse batata with batata-doce', () => {
    expect(lookupInsaMacros(['batata'])?.foodName).toBe('Batata')
    expect(lookupInsaMacros(['batata doce'])?.foodName).toBe('Batata-doce')
    expect(lookupInsaMacros(['batata'])?.macros.calories).not.toBe(
      lookupInsaMacros(['batata doce'])?.macros.calories
    )
  })

  it('returns null when nothing matches', () => {
    expect(lookupInsaMacros([])).toBeNull()
    expect(lookupInsaMacros(['', '   '])).toBeNull()
    expect(lookupInsaMacros(['Whey isolado'])).toBeNull()
  })

  it('matches pão as mistura de trigo e centeio (INSA TCA padaria default)', () => {
    const pao = lookupInsaMacros(['Pão'])
    expect(pao?.foodName).toBe('Pão')
    expect(pao?.macros).toEqual({
      calories: 272,
      protein: 9.0,
      carbs: 53.8,
      fat: 1.4,
      fibre: 4.3,
      source: 'insa',
    })

    expect(lookupInsaMacros(['pão'])?.foodName).toBe('Pão')
    expect(lookupInsaMacros(['PAO'])?.foodName).toBe('Pão')
    expect(lookupInsaMacros(['pão de mistura'])?.foodName).toBe('Pão')
    expect(lookupInsaMacros(['pão da padaria'])?.foodName).toBe('Pão')
  })

  it('matches common Portuguese bread variants on dedicated aliases', () => {
    expect(lookupInsaMacros(['pão de forma'])?.foodName).toBe('Pão de forma')
    expect(lookupInsaMacros(['Pão de Forma'])?.macros.calories).toBe(284)
    expect(lookupInsaMacros(['pão integral'])?.foodName).toBe('Pão integral')
    expect(lookupInsaMacros(['pão de trigo integral'])?.macros.fibre).toBe(7.4)
    expect(lookupInsaMacros(['broa'])?.foodName).toBe('Broa')
    expect(lookupInsaMacros(['pão de milho'])?.foodName).toBe('Broa')
    expect(lookupInsaMacros(['pão branco'])?.foodName).toBe('Pão de trigo')
  })

  it('does not treat pão-like names as bakery bread', () => {
    expect(lookupInsaMacros(['empada'])).toBeNull()
    expect(lookupInsaMacros(['pão de ló'])).toBeNull()
    expect(lookupInsaMacros(['pão de lo'])).toBeNull()
    expect(lookupInsaMacros(['pão ralado'])).toBeNull()
    expect(lookupInsaMacros(['pão de alho'])).toBeNull()
    expect(lookupInsaMacros(['pão de queijo'])).toBeNull()
  })

  it('does not collapse bread variants onto generic pão', () => {
    expect(lookupInsaMacros(['pão'])?.macros.calories).not.toBe(
      lookupInsaMacros(['pão integral'])?.macros.calories
    )
    expect(lookupInsaMacros(['pão'])?.macros.calories).not.toBe(
      lookupInsaMacros(['pão de forma'])?.macros.calories
    )
    expect(lookupInsaMacros(['pão'])?.foodName).not.toBe(
      lookupInsaMacros(['broa'])?.foodName
    )
  })
})

describe('applyInsaSource', () => {
  it('writes real per-100g macros with source insa', () => {
    const applied = applyInsaSource(['tomate'])
    expect(applied).not.toBeNull()
    expect(applied!.macros.source).toBe('insa')
    expect(applied!.macros.calories).toBeGreaterThan(0)
    expect(applied!.macros.protein).toBeGreaterThan(0)
    expect(applied!.macros.carbs).toBeGreaterThan(0)
    expect(applied!.macros.fibre).toBeGreaterThan(0)
  })

  it('does not invent empty macros when unmatched', () => {
    expect(applyInsaSource(['Ovos Classe M Continente'])).toBeNull()
  })

  it('persists applied INSA macros with source insa', () => {
    const applied = applyInsaSource(['cebola'])
    expect(applied).not.toBeNull()
    const desc = upsertMacrosSection('[BuyAmount]\n1', applied!.macros)
    expect(getMacrosFromDesc(desc)).toEqual(applied!.macros)
    expect(getMacrosFromDesc(desc)?.source).toBe('insa')
  })
})

describe('insaLookupNames', () => {
  it('prefers NomeCurto and Generico over the receipt name', () => {
    const names = insaLookupNames({
      productName: 'OVOS CLASSE M CONTINENTE 12UN',
      description: '[NomeCurto]\nOvo\n\n[Generico]\nOvos',
    })
    expect(names[0]).toBe('Ovo')
    expect(names).toContain('Ovos')
    expect(names[names.length - 1]).toBe('OVOS CLASSE M CONTINENTE 12UN')
    expect(lookupInsaMacros(names)?.foodName).toBe('Ovo')
  })

  it('uses the live Generico field when the description has none', () => {
    const names = insaLookupNames({
      productName: 'TOMATE RAMA 1KG',
      description: '[BuyAmount]\n1',
      generico: 'Tomate',
    })
    expect(names[0]).toBe('Tomate')
    expect(applyInsaSource(names)?.macros.source).toBe('insa')
  })

  it('fills INSA macros from NomeCurto or Generico pão', () => {
    const names = insaLookupNames({
      productName: 'PAO MISTURA PADARIA 500G',
      description: '[NomeCurto]\nPão\n\n[Generico]\nPão',
    })
    expect(names[0]).toBe('Pão')
    expect(lookupInsaMacros(names)?.foodName).toBe('Pão')
    expect(applyInsaSource(names)?.macros.calories).toBe(272)
  })
})

describe('insaMissingMessage', () => {
  it('names the product that failed to match', () => {
    expect(insaMissingMessage(['Ovos Classe M'])).toContain('Ovos Classe M')
    expect(insaMissingMessage(['Ovos Classe M'])).toContain('tabela nacional')
  })

  it('handles an empty name list', () => {
    expect(insaMissingMessage([])).toContain('nome de produto')
  })
})

describe('listInsaFoods / searchInsaFoods', () => {
  it('lists curated foods with per-100g values', () => {
    const foods = listInsaFoods()
    expect(foods.length).toBeGreaterThan(20)
    expect(foods.map((f) => f.name)).toContain('Ovo')
    expect(foods.map((f) => f.name)).toContain('Pão')
    expect(foods.map((f) => f.name)).toEqual([...foods.map((f) => f.name)].sort((a, b) => a.localeCompare(b, 'pt')))
    const egg = foods.find((f) => f.name === 'Ovo')
    expect(egg?.calories).toBe(149)
  })

  it('searches by substring on name and aliases, ignoring accents', () => {
    const pao = searchInsaFoods('pão')
    expect(pao.map((f) => f.name)).toEqual(
      expect.arrayContaining(['Pão', 'Pão de trigo', 'Pão de forma', 'Pão integral'])
    )

    expect(searchInsaFoods('PAO').map((f) => f.name)).toEqual(pao.map((f) => f.name))
    expect(searchInsaFoods('ovo').some((f) => f.name === 'Ovo')).toBe(true)
    expect(searchInsaFoods('galinha').some((f) => f.name === 'Ovo')).toBe(true)
  })

  it('returns the full catalog when the query is empty', () => {
    expect(searchInsaFoods('').map((f) => f.name)).toEqual(listInsaFoods().map((f) => f.name))
    expect(searchInsaFoods('   ').length).toBe(listInsaFoods().length)
  })

  it('returns nothing for a query that is not in the table', () => {
    expect(searchInsaFoods('whey isolado')).toEqual([])
    expect(searchInsaFoods('atum')).toEqual([])
  })
})

describe('applyInsaFood (picker selection)', () => {
  it('fills macros with source insa from a catalog name', () => {
    const picked = applyInsaFood('Pão integral')
    expect(picked?.foodName).toBe('Pão integral')
    expect(picked?.macros).toEqual({
      calories: 232,
      protein: 7.6,
      carbs: 39.9,
      fat: 3.0,
      fibre: 7.4,
      source: 'insa',
    })
  })

  it('ignores accents when applying a picked name', () => {
    expect(applyInsaFood('pao')).toEqual(applyInsaFood('Pão'))
    expect(applyInsaFood('maca')?.foodName).toBe('Maçã')
  })

  it('does not apply an alias that is not the canonical name', () => {
    expect(applyInsaFood('ovos')).toBeNull()
    expect(applyInsaFood('pão de mistura')).toBeNull()
  })

  it('lets the user pick a food when the product name does not match', () => {
    const names = ['Ovos Classe M Continente']
    expect(lookupInsaMacros(names)).toBeNull()
    expect(applyInsaSource(names)).toBeNull()

    const found = searchInsaFoods('ovo').find((f) => f.name === 'Ovo')
    expect(found).toBeDefined()
    const picked = applyInsaFood(found!.name)
    expect(picked?.macros.source).toBe('insa')
    expect(picked?.macros.calories).toBe(149)
  })

  it('lets the user change the auto-match suggestion to a different food', () => {
    const suggested = applyInsaSource(['Pão'])
    expect(suggested?.foodName).toBe('Pão')
    expect(suggested?.macros.calories).toBe(272)

    const changed = applyInsaFood('Pão integral')
    expect(changed?.foodName).toBe('Pão integral')
    expect(changed?.macros.calories).not.toBe(suggested?.macros.calories)
    expect(changed?.macros.source).toBe('insa')
  })
})
