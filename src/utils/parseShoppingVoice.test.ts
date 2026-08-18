import { describe, expect, it } from 'vitest'
import { parseShoppingVoice } from './parseShoppingVoice'

describe('parseShoppingVoice', () => {
  it('splits a comma-and-e list', () => {
    expect(parseShoppingVoice('atum, ovos e saco do lixo')).toEqual([
      'atum',
      'ovos',
      'saco do lixo',
    ])
  })

  it('strips preciso de', () => {
    expect(parseShoppingVoice('preciso de leite e pão')).toEqual(['leite', 'pão'])
  })

  it('strips preciso disto before the list', () => {
    expect(parseShoppingVoice('preciso disto, atum, ovos e pão')).toEqual([
      'atum',
      'ovos',
      'pão',
    ])
  })

  it('does not call the AI fallback when local parse works', async () => {
    let called = false
    const names = await resolveHeardShoppingNames('leite e pão', async () => {
      called = true
      return ['inventado']
    })
    expect(names).toEqual(['leite', 'pão'])
    expect(called).toBe(false)
  })

  it('uses the fallback when the utterance does not parse as a list', async () => {
    const names = await resolveHeardShoppingNames('trazer aquilo do costume', async () => [
      'leite',
    ])
    expect(names).toEqual(['leite'])
  })

  it('keeps a name that contains do', () => {
    expect(parseShoppingVoice('saco do lixo')).toEqual(['saco do lixo'])
  })

  it('strips a leading count', () => {
    expect(parseShoppingVoice('2 latas de atum e pão')).toEqual(['atum', 'pão'])
  })

  it('returns empty for filler only', () => {
    expect(parseShoppingVoice('preciso disto')).toEqual([])
    expect(parseShoppingVoice('   ')).toEqual([])
  })

  it('dedupes repeated names in one utterance', () => {
    expect(parseShoppingVoice('leite, leite e pão')).toEqual(['leite', 'pão'])
  })
})
