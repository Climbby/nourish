import { describe, expect, it } from 'vitest'
import { friendlyNetworkError, isNetworkFetchError } from './pwaRecovery'

describe('isNetworkFetchError', () => {
  it('detects common fetch network failures', () => {
    expect(isNetworkFetchError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkFetchError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true)
    expect(isNetworkFetchError(new Error('Load failed'))).toBe(true)
  })

  it('ignores HTTP-level errors', () => {
    expect(isNetworkFetchError(new Error('Grocy 500: boom'))).toBe(false)
  })
})

describe('friendlyNetworkError', () => {
  it('returns a user-facing message for network failures', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'onLine')
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    try {
      expect(friendlyNetworkError(new TypeError('Failed to fetch'))).toContain('servidor')
    } finally {
      if (original) Object.defineProperty(navigator, 'onLine', original)
      else delete (navigator as { onLine?: boolean }).onLine
    }
  })
})
