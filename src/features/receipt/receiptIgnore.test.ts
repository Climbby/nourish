import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ignoreReceiptNames,
  isReceiptNameIgnored,
  loadReceiptIgnoreList,
  receiptIgnoreNamesForProducts,
  syncReceiptIgnoreFromReview,
  unignoreReceiptNames,
} from './receiptIgnore'

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
  })
})

describe('receiptIgnore', () => {
  it('matches accent- and case-insensitively', () => {
    ignoreReceiptNames(['SACO LIXO'])
    expect(isReceiptNameIgnored('saco lixo')).toBe(true)
    expect(isReceiptNameIgnored('Saco Lixo')).toBe(true)
    expect(isReceiptNameIgnored('LEITE UHT')).toBe(false)
  })

  it('does not fuzzy-match a different product', () => {
    ignoreReceiptNames(['SACO LIXO'])
    expect(isReceiptNameIgnored('SACO COMPRAS')).toBe(false)
    expect(isReceiptNameIgnored('LIXO ORGANICO')).toBe(false)
  })

  it('removes a name when the cook adds it after all', () => {
    ignoreReceiptNames(['SACO LIXO', 'SAQUINHO'])
    unignoreReceiptNames(['saco lixo'])
    expect(loadReceiptIgnoreList()).toEqual(['saquinho'])
  })

  it('syncs review checkboxes onto the list', () => {
    syncReceiptIgnoreFromReview([
      { included: false, names: ['SACO LIXO'] },
      { included: true, names: ['LEITE UHT'] },
    ])
    expect(isReceiptNameIgnored('SACO LIXO')).toBe(true)
    expect(isReceiptNameIgnored('LEITE UHT')).toBe(false)

    syncReceiptIgnoreFromReview([{ included: true, names: ['SACO LIXO'] }])
    expect(isReceiptNameIgnored('SACO LIXO')).toBe(false)
  })

  it('collects SKU names and a unique Generico for a family', () => {
    expect(
      receiptIgnoreNamesForProducts([
        { name: 'Cogumelos Continente', description: '[Generico]\nCogumelos' },
        { name: 'Cogumelos Auchan', description: '[Generico]\nCogumelos' },
      ])
    ).toEqual(['Cogumelos Continente', 'Cogumelos', 'Cogumelos Auchan'])
  })

  it('omits Generico when ignoring a single SKU in a family', () => {
    expect(
      receiptIgnoreNamesForProducts(
        [{ name: 'Cogumelos Continente', description: '[Generico]\nCogumelos' }],
        { includeGenerico: false }
      )
    ).toEqual(['Cogumelos Continente'])
  })
})
