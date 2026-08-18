import { describe, expect, it } from 'vitest'
import { stripHtml } from './stripHtml'

describe('stripHtml', () => {
  it('turns br and closing p into newlines so description sections survive Grocy HTML', () => {
    expect(stripHtml('<p>[Local]<br />Cantina do ISCTE</p>')).toBe('[Local]\nCantina do ISCTE')
    expect(stripHtml('<p>[Origem]</p><p>restaurante</p>')).toBe('[Origem]\nrestaurante')
  })
})
