import { describe, expect, it } from 'vitest'
import { carDisplayName, carMake } from './carDisplayName'
import type { Car } from '../hooks/useCars'

const audi: Car = { id: '1', name: 'Audi A3', consumption_l100km: 7.2, fuel_type: 'gpl_gasoline' }
const golf: Car = { id: '2', name: 'Volkswagen Golf', consumption_l100km: 5.8 }

describe('carDisplayName', () => {
  it('uses make when only one car of that brand', () => {
    expect(carMake('Audi A3 (3 portas)')).toBe('Audi')
    expect(carDisplayName(audi, [audi])).toBe('Audi')
  })

  it('keeps full name when several cars share the make', () => {
    const audiTt: Car = { ...audi, id: '3', name: 'Audi TT' }
    expect(carDisplayName(audi, [audi, audiTt])).toBe('Audi A3')
  })

  it('uses make when only one car of that brand in the fleet', () => {
    expect(carDisplayName(golf, [audi, golf])).toBe('Volkswagen')
  })
})
