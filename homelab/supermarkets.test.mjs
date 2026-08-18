import assert from 'node:assert/strict'
import test from 'node:test'
import { filterBlockedVisits, placeMatchesBlocked, visitMatchesBlocklist } from './supermarkets.mjs'

const ignored = [{ place_key: 'intermarche_condeixa_a_nova', name: 'Intermarché Condeixa-a-Nova' }]

test('placeMatchesBlocked folds accents and zone prefixes', () => {
  assert.equal(placeMatchesBlocked('zone.intermarche', ignored), true)
  assert.equal(placeMatchesBlocked('Intermarché Condeixa-a-Nova', ignored), true)
  assert.equal(placeMatchesBlocked('receipt.intermarche', ignored), true)
  assert.equal(placeMatchesBlocked('zone.auchan', ignored), false)
})

test('filterBlockedVisits drops ignored Intermarché visits', () => {
  const visits = [
    { entered_at: '1', zone: 'zone.auchan' },
    { entered_at: '2', zone: 'zone.intermarche' },
    { entered_at: '3', zone: 'zone.intermarche_condeixa_a_nova' },
  ]
  assert.deepEqual(
    filterBlockedVisits(visits, ignored).map((v) => v.entered_at),
    ['1']
  )
})

test('visitMatchesBlocklist uses persisted zone_id', () => {
  const withZone = [{ ...ignored[0], zone_id: 'zone.a1b2c3d4' }]
  assert.equal(visitMatchesBlocklist({ zone: 'zone.a1b2c3d4' }, withZone), true)
  assert.equal(visitMatchesBlocklist({ zone: 'zone.auchan' }, withZone), false)
})
