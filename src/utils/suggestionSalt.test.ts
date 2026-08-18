import { beforeEach, describe, expect, it } from 'vitest'
import { loadSuggestionSalt, rotateSuggestionSalt, saveSuggestionSalt } from './suggestionSalt'

describe('suggestionSalt', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates and persists a salt on first load', () => {
    const first = loadSuggestionSalt()
    expect(first).toBeGreaterThan(0)
    expect(loadSuggestionSalt()).toBe(first)
  })

  it('round-trips a saved salt', () => {
    saveSuggestionSalt(12345)
    expect(loadSuggestionSalt()).toBe(12345)
  })

  it('rotateSuggestionSalt writes a new value', () => {
    saveSuggestionSalt(1)
    const next = rotateSuggestionSalt()
    expect(next).not.toBe(1)
    expect(loadSuggestionSalt()).toBe(next)
  })
})
