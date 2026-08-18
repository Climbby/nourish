import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getGenericoFavoriteId,
  loadGenericoFavorites,
  saveGenericoFavorites,
  setGenericoFavorite,
} from './genericoFavorites'

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

describe('genericoFavorites', () => {
  it('starts empty', () => {
    expect(loadGenericoFavorites()).toEqual({})
  })

  it('round-trips one favorite per family', () => {
    setGenericoFavorite('cogumelos', 12)
    setGenericoFavorite('atum', 7)
    expect(loadGenericoFavorites()).toEqual({ cogumelos: 12, atum: 7 })
    expect(getGenericoFavoriteId('cogumelos')).toBe(12)
  })

  it('switches the favorite when starring another variant', () => {
    setGenericoFavorite('cogumelos', 12)
    setGenericoFavorite('cogumelos', 34)
    expect(loadGenericoFavorites().cogumelos).toBe(34)
  })

  it('drops invalid ids and blank keys', () => {
    saveGenericoFavorites({ cogumelos: 12 })
    store.set(
      [...store.keys()][0],
      JSON.stringify({ cogumelos: 12, '': 5, leite: 'nope', ovos: 0 })
    )
    expect(loadGenericoFavorites()).toEqual({ cogumelos: 12 })
  })

  it('survives corrupt storage', () => {
    saveGenericoFavorites({ cogumelos: 1 })
    store.set([...store.keys()][0], '{ not json')
    expect(loadGenericoFavorites()).toEqual({})
  })
})
