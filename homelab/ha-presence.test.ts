// @ts-nocheck — homelab ESM module
import { describe, expect, it, vi } from 'vitest'
import { fetchHaAtHome } from './ha-presence.mjs'

describe('fetchHaAtHome', () => {
  it('returns at_home true when person state is home', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ state: 'home' }),
    }))
    const result = await fetchHaAtHome('http://ha.local', 'token', 'person.test', fetchFn)
    expect(result).toEqual({ at_home: true, state: 'home', entity_id: 'person.test' })
    expect(fetchFn).toHaveBeenCalledWith(
      'http://ha.local/api/states/person.test',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      })
    )
  })

  it('returns at_home false when not_home', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ state: 'not_home' }),
    }))
    const result = await fetchHaAtHome('http://ha.local', 'token', 'person.test', fetchFn)
    expect(result.at_home).toBe(false)
    expect(result.state).toBe('not_home')
  })
})
