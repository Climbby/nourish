import { describe, expect, it } from 'vitest'
import {
  isVerified,
  parseVerifiedFields,
  upsertVerifiedSection,
} from './verification'
import { buildDespensaDescription } from './despensaAnalytics'

describe('verification', () => {
  it('parses and upserts verified fields', () => {
    const desc = upsertVerifiedSection(
      buildDespensaDescription(1, 2.5),
      new Set(['preco', 'calorias'])
    )
    expect(parseVerifiedFields(desc)).toEqual(new Set(['preco', 'calorias']))
    expect(isVerified(desc, 'preco')).toBe(true)
    expect(isVerified(desc, 'nutricao')).toBe(false)
  })

  it('removes section when empty', () => {
    const withV = upsertVerifiedSection('[BuyAmount]\n1', new Set(['preco']))
    const cleared = upsertVerifiedSection(withV, new Set())
    expect(cleared).toBe('[BuyAmount]\n1')
    expect(parseVerifiedFields(cleared).size).toBe(0)
  })
})
