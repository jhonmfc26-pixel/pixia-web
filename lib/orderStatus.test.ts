/**
 * Estados post-venta y correos al cliente.
 *   npx tsx --test lib/orderStatus.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canTransition, parseShipment, statusIndex } from './orderStatus'
import { buildStatusEmail } from './email'

test('solo se avanza; corregir la guía de un enviado sí se permite', () => {
  assert.equal(canTransition('paid', 'printing'), true)
  assert.equal(canTransition('paid', 'shipped'), true) // se saltó "en impresión"
  assert.equal(canTransition('printing', 'shipped'), true)
  assert.equal(canTransition('shipped', 'delivered'), true)
  assert.equal(canTransition('shipped', 'shipped'), true)
  assert.equal(canTransition('shipped', 'printing'), false)
  assert.equal(canTransition('delivered', 'shipped'), false)
  assert.equal(canTransition('printing', 'printing'), false)
  assert.equal(canTransition(null, 'printing'), false)
  assert.equal(statusIndex('raro'), -1)
})

test('parseShipment valida transportadora, guía y URL', () => {
  assert.deepEqual(parseShipment({ carrier: ' Servientrega ', trackingNumber: ' 123 ', trackingUrl: '' }),
    { ok: true, value: { carrier: 'Servientrega', trackingNumber: '123', trackingUrl: null } })
  assert.equal(parseShipment({ carrier: '', trackingNumber: '1' }).ok, false)
  assert.equal(parseShipment({ carrier: 'TCC', trackingNumber: '' }).ok, false)
  assert.equal(parseShipment({ carrier: 'TCC', trackingNumber: '1', trackingUrl: 'javascript:alert(1)' }).ok, false)
  const ok = parseShipment({ carrier: 'TCC', trackingNumber: '1', trackingUrl: 'https://tcc.com.co/r?g=1' })
  assert.ok(ok.ok && ok.value.trackingUrl === 'https://tcc.com.co/r?g=1')
})

test('correo de envío: guía, enlace al álbum y escape de HTML', () => {
  const m = buildStatusEmail({
    kind: 'shipped', reference: 'PIXIA-ABC', customerName: 'Laura <b>Gómez</b>', customerEmail: 'l@x.co',
    albumTitle: 'Nuestra boda', bookId: 'b1', carrier: 'Servientrega', trackingNumber: '999', trackingUrl: 'https://s.co/?a=1&b=2',
  }, { siteUrl: 'https://pixiaa.com', support: 'soporte@pixiaa.com' })
  assert.match(m.subject, /en camino/)
  assert.match(m.html, /999/)
  assert.match(m.html, /https:\/\/pixiaa\.com\/book\/b1/)
  assert.match(m.html, /a=1&amp;b=2/)
  assert.doesNotMatch(m.html, /<b>Gómez/)
  assert.match(m.text, /Número de guía: 999/)
})

test('correos de impresión y entrega', () => {
  const p = buildStatusEmail({ kind: 'printing', reference: 'R', customerName: 'Ana', customerEmail: 'a@x.co' })
  assert.match(p.subject, /impresión/)
  assert.doesNotMatch(p.html, /Número de guía/)
  const d = buildStatusEmail({ kind: 'delivered', reference: 'R', customerName: 'Ana', customerEmail: 'a@x.co' })
  assert.match(d.subject, /llegó/)
  assert.match(d.html, /mis-albumes/)
})
