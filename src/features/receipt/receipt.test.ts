import { describe, expect, it } from 'vitest'
import { detectStoreFromText, parseReceipt } from './parsers'
import { findBestProductMatch } from './matchProduct'
import { getAliasProductId, setAlias } from './receiptAliases'

const FIXTURE_CONTINENTE = `CONTINENTE HYPER
NIF 500000000
LEITE UHT MEIO GORDO 1L 0,89
IOGURTE NATURAL 4X125G 1,49
PAO DE FORMA INTEGRAL 1,29
TOTAL 3,67
`

const FIXTURE_AUCHAN = `AUCHAN RETAIL PORTUGAL
LEITE UHT 1L 0,95 EUR
MANTEIGA 250G 2,15
TOTAL EUR 3,10
`

const FIXTURE_GENERIC = `PRODUTO TESTE ABC 2,50
2 x 1,00 AGUA 2,00
TOTAL 4,50
`

describe('receipt parsers', () => {
  it('detects Continente from header', () => {
    expect(detectStoreFromText(FIXTURE_CONTINENTE)).toBe('continente')
  })

  it('detects Auchan from header', () => {
    expect(detectStoreFromText(FIXTURE_AUCHAN)).toBe('auchan')
  })

  it('parses Continente fixture lines', () => {
    const lines = parseReceipt(FIXTURE_CONTINENTE, 'continente')
    expect(lines.length).toBeGreaterThanOrEqual(3)
    expect(lines.some((l) => l.name.toUpperCase().includes('LEITE'))).toBe(true)
    expect(lines.find((l) => l.name.includes('LEITE'))?.lineTotal).toBe(0.89)
  })

  it('parses Auchan fixture lines', () => {
    const lines = parseReceipt(FIXTURE_AUCHAN, 'auchan')
    expect(lines.length).toBeGreaterThanOrEqual(2)
    expect(lines.some((l) => l.lineTotal === 2.15)).toBe(true)
  })

  it('parses generic lines with qty prefix', () => {
    const lines = parseReceipt(FIXTURE_GENERIC, 'mixed')
    expect(lines.length).toBeGreaterThanOrEqual(2)
    const water = lines.find((l) => l.name.toUpperCase().includes('AGUA'))
    expect(water?.qty).toBe(2)
    expect(water?.lineTotal).toBe(2)
  })
})

describe('matchProduct', () => {
  const products = [
    { id: 1, name: 'Leite', description: null, product_group_id: 6, qu_id_stock: 2, qu_id_purchase: 2, picture_file_name: null, calories: null },
    { id: 2, name: 'Manteiga', description: null, product_group_id: 6, qu_id_stock: 2, qu_id_purchase: 2, picture_file_name: null, calories: null },
  ] as const

  it('matches similar receipt name to product', () => {
    const m = findBestProductMatch('LEITE UHT MEIO GORDO 1L', [...products])
    expect(m?.productId).toBe(1)
    expect(m!.score).toBeGreaterThan(0.4)
  })

  it('uses saved alias over fuzzy match', () => {
    const key = 'IOGURTE NATURAL 4X125G'
    setAlias(key, 2)
    const m = findBestProductMatch(key, [...products])
    expect(m?.productId).toBe(2)
    expect(getAliasProductId(key)).toBe(2)
  })
})
