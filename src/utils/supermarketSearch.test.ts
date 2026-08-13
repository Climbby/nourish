import { describe, expect, it } from 'vitest'
import {
  coordsForTracking,
  filterKnownSupermarkets,
  isKnownSupermarket,
  normalizePlaceKey,
  type SupermarketSearchHit,
} from './supermarketSearch'

const hit = (
  partial: Partial<SupermarketSearchHit> & Pick<SupermarketSearchHit, 'name' | 'title'>
): SupermarketSearchHit => ({
  id: 'n-1',
  subtitle: '',
  latitude: 40.1,
  longitude: -8.5,
  ...partial,
})

describe('normalizePlaceKey', () => {
  it('matches server-style keys', () => {
    expect(normalizePlaceKey('Auchan Condeixa-a-Nova')).toBe('auchan_condeixa_a_nova')
  })
})

describe('isKnownSupermarket / filterKnownSupermarkets', () => {
  it('filters by place_key overlap', () => {
    const known = [{ place_key: 'auchan_condeixa_a_nova', name: 'Auchan Condeixa-a-Nova' }]
    expect(
      isKnownSupermarket(hit({ name: 'Auchan Condeixa-a-Nova', title: 'Auchan' }), known)
    ).toBe(true)
    expect(
      filterKnownSupermarkets(
        [
          hit({ id: '1', name: 'Auchan Condeixa-a-Nova', title: 'Auchan' }),
          hit({ id: '2', name: 'Lidl Coimbra', title: 'Lidl', latitude: 40.2, longitude: -8.4 }),
        ],
        known
      )
    ).toHaveLength(1)
  })

  it('filters by proximity to a tracked pin', () => {
    const known = [
      {
        place_key: 'auchan',
        name: 'Auchan',
        latitude: 40.1,
        longitude: -8.5,
      },
    ]
    expect(
      isKnownSupermarket(hit({ name: 'Something Else', title: 'Other', latitude: 40.1001, longitude: -8.5001 }), known)
    ).toBe(true)
  })
})

describe('coordsForTracking', () => {
  it('uses phone GPS when close to the OSM pin', () => {
    const poi = hit({ name: 'Auchan', title: 'Auchan', latitude: 40.1, longitude: -8.5 })
    const gps = { latitude: 40.1004, longitude: -8.5003 }
    expect(coordsForTracking(poi, gps)).toEqual(gps)
  })

  it('keeps OSM coords when GPS is far away', () => {
    const poi = hit({ name: 'Auchan', title: 'Auchan', latitude: 40.1, longitude: -8.5 })
    const gps = { latitude: 40.2, longitude: -8.4 }
    expect(coordsForTracking(poi, gps)).toEqual({
      latitude: poi.latitude,
      longitude: poi.longitude,
    })
  })
})
