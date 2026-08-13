import { describe, expect, it } from 'vitest'
import type { TrackedSupermarket } from '../../utils/supermarkets'
import { resolveReceiptStore } from './resolveReceiptStore'

const continente: TrackedSupermarket = {
  id: 'continente_bom_dia_condeixa_a_nova',
  name: 'Continente Bom Dia Condeixa-a-Nova',
  place_key: 'continente_bom_dia_condeixa_a_nova',
  zone_id: 'zone.continente_bom_dia_condeixa_a_nova',
  added_at: '2026-07-25T14:17:26.498Z',
}

const auchan: TrackedSupermarket = {
  id: 'auchan_condeixa_a_nova',
  name: 'Auchan Condeixa-a-Nova',
  place_key: 'auchan_condeixa_a_nova',
  zone_id: 'zone.auchan_condeixa_a_nova',
  added_at: '2026-07-25T16:31:00.040Z',
}

describe('resolveReceiptStore', () => {
  it('uses visit zone when provided', () => {
    expect(
      resolveReceiptStore('continente', [continente, auchan], 'zone.continente_bom_dia_condeixa_a_nova')
    ).toEqual({
      store_id: 'zone.continente_bom_dia_condeixa_a_nova',
      store_label: 'Continente Bom Dia Condeixa-a-Nova',
    })
  })

  it('matches tracked Continente by brand without a visit', () => {
    expect(resolveReceiptStore('continente', [continente, auchan])).toEqual({
      store_id: 'zone.continente_bom_dia_condeixa_a_nova',
      store_label: 'Continente Bom Dia Condeixa-a-Nova',
    })
  })

  it('falls back to receipt.brand when nothing is tracked', () => {
    expect(resolveReceiptStore('continente', [])).toEqual({
      store_id: 'receipt.continente',
      store_label: 'Continente',
    })
  })

  it('does not pick Auchan for a Continente receipt', () => {
    expect(resolveReceiptStore('continente', [auchan]).store_id).toBe('receipt.continente')
  })
})
