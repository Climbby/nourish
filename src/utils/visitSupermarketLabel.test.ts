import { describe, expect, it } from 'vitest'
import { formatTripRouteLabel, supermarketLabelForVisit, supermarketLabelFromZone } from './visitSupermarketLabel'

describe('visitSupermarketLabel', () => {
  it('resolves tracked supermarket by zone_id', () => {
    expect(
      supermarketLabelFromZone('zone.lidl_alfragide', [
        { id: '1', name: 'Lidl Alfragide', place_key: 'lidl_alfragide', zone_id: 'zone.lidl_alfragide', added_at: '' },
      ])
    ).toBe('Lidl Alfragide')
  })

  it('falls back to known store names', () => {
    expect(supermarketLabelFromZone('zone.auchan')).toBe('Auchan')
  })

  it('formats trip route from home', () => {
    expect(formatTripRouteLabel(6.6, 'Auchan')).toBe('Casa → Auchan · 6.6 km ida/volta')
    expect(formatTripRouteLabel(6.6)).toBe('Casa · 6.6 km ida/volta')
    expect(formatTripRouteLabel(undefined, 'Auchan')).toBe('Casa → Auchan')
    expect(formatTripRouteLabel()).toBe('Casa')
  })

  it('labels visit without zone generically', () => {
    expect(supermarketLabelForVisit({ zone: undefined })).toBe('Supermercado')
  })
})
