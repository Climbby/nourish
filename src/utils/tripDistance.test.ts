// @ts-nocheck — homelab ESM module
import { describe, expect, it } from 'vitest'
import { haversineKm, roundTripKmFromZoneCoords } from '../../homelab/trip-distance.mjs'

const home = { latitude: 40.105715, longitude: -8.465373 }
const auchan = { latitude: 40.106675, longitude: -8.492614 }

describe('trip-distance zone fallback', () => {
  it('computes one-way haversine between zone centres', () => {
    const km = haversineKm(home, auchan)
    expect(km).toBeGreaterThan(2)
    expect(km).toBeLessThan(4)
  })

  it('round trip from zones is twice one-way', () => {
    const oneWay = haversineKm(home, auchan)
    expect(roundTripKmFromZoneCoords(home, auchan)).toBeCloseTo(oneWay * 2, 1)
  })
})
