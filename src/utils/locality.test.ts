import { describe, expect, it } from 'vitest'
import { localityLabelFromPhotonProps, formatDistanceKm, estimateDriveMinutes } from './locality'

describe('localityLabelFromPhotonProps', () => {
  it('formats village + county as Condeixa, Coimbra', () => {
    expect(
      localityLabelFromPhotonProps({
        village: 'Condeixa-a-Nova',
        county: 'Coimbra',
      })
    ).toBe('Condeixa-a-Nova, Coimbra')
  })

  it('uses city when village missing', () => {
    expect(localityLabelFromPhotonProps({ city: 'Coimbra', state: 'Coimbra' })).toBe('Coimbra')
  })

  it('returns null when empty', () => {
    expect(localityLabelFromPhotonProps({})).toBeNull()
  })
})

describe('distance helpers', () => {
  it('formats metres and km', () => {
    expect(formatDistanceKm(450)).toBe('450 m')
    expect(formatDistanceKm(2500)).toBe('2.5 km')
    expect(formatDistanceKm(15000)).toBe('15 km')
  })

  it('estimates drive minutes', () => {
    expect(estimateDriveMinutes(20000)).toBe(30)
  })
})
