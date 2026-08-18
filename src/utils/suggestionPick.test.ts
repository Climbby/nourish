import { describe, expect, it } from 'vitest'
import { createRng, hashSeed, pickScored } from './suggestionPick'

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('diverges across seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)())
  })
})

describe('hashSeed', () => {
  it('is stable and sensitive to each part', () => {
    expect(hashSeed('a', 1)).toBe(hashSeed('a', 1))
    expect(hashSeed('a', 1)).not.toBe(hashSeed('a', 2))
    expect(hashSeed('a', 1)).not.toBe(hashSeed('b', 1))
  })
})

describe('pickScored', () => {
  it('returns undefined for an empty list', () => {
    expect(pickScored([], createRng(1))).toBeUndefined()
  })

  it('returns the only candidate', () => {
    expect(pickScored([{ id: 1, score: 4 }], createRng(1))?.id).toBe(1)
  })

  it('keeps a clear winner outside the score window', () => {
    const ranked = [
      { id: 1, score: 12 },
      { id: 2, score: 4 },
      { id: 3, score: 3 },
    ]
    for (const seed of [1, 2, 3, 99, 1000]) {
      expect(pickScored(ranked, createRng(seed))?.id).toBe(1)
    }
  })

  it('mixes near-tied scores instead of always taking the first', () => {
    const tied = [1, 2, 3, 4, 5, 6].map((id) => ({ id, score: 10 }))
    const picked = new Set(
      [1, 2, 3, 7, 11, 19, 23, 29].map((seed) => pickScored(tied, createRng(seed))!.id)
    )
    expect(picked.size).toBeGreaterThan(1)
  })

  it('skips sentinal exclude scores', () => {
    const ranked = [
      { id: 1, score: -999 },
      { id: 2, score: 8 },
    ]
    expect(pickScored(ranked, createRng(1))?.id).toBe(2)
  })
})
