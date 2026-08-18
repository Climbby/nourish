import { describe, expect, it } from 'vitest'
import {
  filterIgnoredVisits,
  identityMatchesBlocked,
  ignoreTargetForVisit,
  isIgnoredStorePrice,
  supermarketIdentityKey,
  visitIsIgnored,
} from './ignoredSupermarket'

const ignoredCondeixa = {
  place_key: 'intermarche_condeixa_a_nova',
  name: 'Intermarché Condeixa-a-Nova',
}

describe('supermarketIdentityKey', () => {
  it('folds accents and strips zone/receipt prefixes', () => {
    expect(supermarketIdentityKey('Intermarché Condeixa-a-Nova')).toBe(
      'intermarche_condeixa_a_nova'
    )
    expect(supermarketIdentityKey('zone.intermarche')).toBe('intermarche')
    expect(supermarketIdentityKey('receipt.intermarche')).toBe('intermarche')
  })
})

describe('identityMatchesBlocked', () => {
  it('matches the same place_key used when ignoring', () => {
    expect(
      identityMatchesBlocked({ zone: 'zone.intermarche_condeixa_a_nova' }, ignoredCondeixa)
    ).toBe(true)
  })

  it('matches generic HA / receipt brand ids to a locality ignore', () => {
    expect(identityMatchesBlocked({ zone: 'zone.intermarche' }, ignoredCondeixa)).toBe(true)
    expect(identityMatchesBlocked({ storeId: 'receipt.intermarche' }, ignoredCondeixa)).toBe(
      true
    )
  })

  it('matches by display name (accents / hyphens)', () => {
    expect(
      identityMatchesBlocked({ name: 'Intermarche Condeixa a Nova' }, ignoredCondeixa)
    ).toBe(true)
  })

  it('matches persisted HA zone_id that is not the slug', () => {
    expect(
      identityMatchesBlocked(
        { zone: 'zone.a1b2c3d4' },
        { ...ignoredCondeixa, zone_id: 'zone.a1b2c3d4' }
      )
    ).toBe(true)
  })

  it('does not hide a different city of the same brand', () => {
    expect(
      identityMatchesBlocked({ zone: 'zone.intermarche_coimbra' }, ignoredCondeixa)
    ).toBe(false)
  })

  it('does not match a different brand', () => {
    expect(identityMatchesBlocked({ zone: 'zone.auchan' }, ignoredCondeixa)).toBe(false)
    expect(
      identityMatchesBlocked(
        { zone: 'zone.continente_bom_dia_condeixa_a_nova' },
        ignoredCondeixa
      )
    ).toBe(false)
  })
})

describe('filterIgnoredVisits', () => {
  it('drops ignored-store visits from historial', () => {
    const visits = [
      { entered_at: '1', zone: 'zone.auchan' },
      { entered_at: '2', zone: 'zone.intermarche' },
      { entered_at: '3', zone: 'zone.intermarche_condeixa_a_nova' },
    ]
    expect(filterIgnoredVisits(visits, [ignoredCondeixa]).map((v) => v.entered_at)).toEqual([
      '1',
    ])
  })

  it('matches via the same label shown in historial', () => {
    const visits = [{ entered_at: '1', zone: 'zone.unknown_id' }]
    expect(
      visitIsIgnored(visits[0], [ignoredCondeixa], 'Intermarché Condeixa-a-Nova')
    ).toBe(true)
    expect(filterIgnoredVisits(visits, [ignoredCondeixa], () => 'Auchan')).toHaveLength(1)
  })
})

describe('isIgnoredStorePrice', () => {
  it('hides preço-por-loja rows for an ignored store', () => {
    expect(
      isIgnoredStorePrice(
        { store_id: 'receipt.intermarche', store_label: 'Intermarché' },
        [ignoredCondeixa]
      )
    ).toBe(true)
    expect(
      isIgnoredStorePrice(
        { store_id: 'zone.auchan', store_label: 'Auchan' },
        [ignoredCondeixa]
      )
    ).toBe(false)
  })
})

describe('ignoreTargetForVisit', () => {
  it('uses tracked name and zone_id when the visit zone matches', () => {
    expect(
      ignoreTargetForVisit(
        { zone: 'zone.abc' },
        [
          {
            name: 'Intermarché Condeixa-a-Nova',
            place_key: 'intermarche_condeixa_a_nova',
            zone_id: 'zone.abc',
          },
        ],
        'Intermarché Condeixa-a-Nova'
      )
    ).toEqual({
      place: 'Intermarché Condeixa-a-Nova',
      zone_id: 'zone.abc',
    })
  })

  it('falls back to the historial label', () => {
    expect(
      ignoreTargetForVisit({ zone: 'zone.intermarche' }, [], 'Intermarché')
    ).toEqual({ place: 'Intermarché', zone_id: 'zone.intermarche' })
  })
})
