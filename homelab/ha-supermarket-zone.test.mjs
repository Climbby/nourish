import assert from 'node:assert/strict'
import test from 'node:test'
import { findExistingZone } from './ha-supermarket-zone.mjs'

test('findExistingZone prefers exact entity id', () => {
  const zones = [
    { entity_id: 'zone.other', name: 'Other', latitude: 1, longitude: 2, radius: 100 },
    { entity_id: 'zone.continente_bom_dia_condeixa_a_nova', name: 'Continente Bom Dia Condeixa-a-Nova', latitude: 1, longitude: 2, radius: 130 },
  ]
  const hit = findExistingZone(zones, 'continente_bom_dia_condeixa_a_nova', 'Continente Bom Dia Condeixa-a-Nova')
  assert.equal(hit.entity_id, 'zone.continente_bom_dia_condeixa_a_nova')
})

test('findExistingZone falls back to friendly name', () => {
  const zones = [
    { entity_id: 'zone.auchan', name: 'Auchan Condeixa-a-Nova', latitude: 1, longitude: 2, radius: 135 },
  ]
  const hit = findExistingZone(zones, 'auchan_condeixa_a_nova', 'Auchan Condeixa-a-Nova')
  assert.equal(hit.entity_id, 'zone.auchan')
})

test('findNearbyZone reuses legacy zone within 100m', async () => {
  const { findNearbyZone } = await import('./ha-supermarket-zone.mjs')
  const zones = [
    { entity_id: 'zone.auchan', name: 'Auchan', latitude: 40.106675, longitude: -8.492614, radius: 135 },
  ]
  const hit = findNearbyZone(zones, 40.1063164, -8.492507, 100)
  assert.equal(hit.entity_id, 'zone.auchan')
})

test('findExistingZone returns null when missing', () => {
  assert.equal(findExistingZone([], 'x', 'Y'), null)
})
