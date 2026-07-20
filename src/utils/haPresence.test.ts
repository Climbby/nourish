import { describe, expect, it } from 'vitest'
import { originFromAtHome } from './haPresence'

describe('originFromAtHome', () => {
  it('maps home to supermercado and away to restaurante', () => {
    expect(originFromAtHome(true)).toBe('supermercado')
    expect(originFromAtHome(false)).toBe('restaurante')
    expect(originFromAtHome(null)).toBeNull()
  })
})
