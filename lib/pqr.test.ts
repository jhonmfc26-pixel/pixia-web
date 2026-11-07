/**
 *   npx tsx --test lib/pqr.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addBusinessDays, businessDaysUntil, colombianHolidays, isBusinessDay } from './businessDays'
import { generateRadicado, parsePqrInput, pqrDeadline } from './pqr'

const d = (s: string) => new Date(`${s}T00:00:00Z`)

test('festivos de Colombia 2026 (calendario oficial)', () => {
  const h = colombianHolidays(2026)
  for (const day of [
    '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18',
    '2026-06-08', '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12',
    '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25',
  ]) assert.ok(h.has(day), `falta ${day}`)
  assert.equal(h.size, 18)
})

test('días hábiles: fines de semana y festivos no cuentan', () => {
  assert.equal(isBusinessDay(d('2026-11-07')), false) // sábado
  assert.equal(isBusinessDay(d('2026-11-16')), false) // festivo (Independencia de Cartagena)
  assert.equal(isBusinessDay(d('2026-11-17')), true)
  // Radicado viernes 6-nov-2026: 15 hábiles → se salta el festivo del 16-nov
  assert.equal(addBusinessDays(d('2026-11-06'), 15).toISOString().slice(0, 10), '2026-11-30')
  assert.equal(businessDaysUntil(d('2026-11-06'), d('2026-11-30')), 15)
  assert.equal(businessDaysUntil(d('2026-11-30'), d('2026-11-06')), -15)
})

test('plazo PQR: consulta de datos 10 hábiles, reclamo 15', () => {
  const created = new Date('2026-11-06T23:30:00Z') // 6:30 p. m. en Bogotá, sigue siendo 6-nov
  assert.equal(pqrDeadline('datos_consulta', created).toISOString().slice(0, 10), '2026-11-23')
  assert.equal(pqrDeadline('reclamo', created).toISOString().slice(0, 10), '2026-11-30')
})

test('radicado: fecha de Bogotá y código sin caracteres ambiguos', () => {
  const r = generateRadicado(new Date('2026-11-07T03:00:00Z'), n => new Uint8Array(n).fill(0))
  assert.equal(r, 'PQR-20261106-AAAAAA') // 10 p. m. del 6 en Bogotá
  assert.match(generateRadicado(), /^PQR-\d{8}-[A-HJ-NP-Z2-9]{6}$/)
})

test('validación del formulario', () => {
  const ok = parsePqrInput({ type: 'garantia', name: ' Ana ', email: 'ANA@X.CO', message: 'La tapa llegó golpeada', orderReference: 'pixia-1' })
  assert.ok(ok.ok && ok.value.email === 'ana@x.co' && ok.value.orderReference === 'PIXIA-1' && ok.value.phone === null)
  assert.equal(parsePqrInput({ type: 'otro', name: 'Ana', email: 'a@x.co', message: '1234567890' }).ok, false)
  assert.equal(parsePqrInput({ type: 'queja', name: 'Ana', email: 'nope', message: '1234567890' }).ok, false)
  assert.equal(parsePqrInput({ type: 'queja', name: 'Ana', email: 'a@x.co', message: 'corto' }).ok, false)
})

test('correos PQR: constancia con radicado y enlace de seguimiento; HTML escapado', async () => {
  const { buildPqrReceiptEmail, buildPqrResponseEmail } = await import('./email')
  const data = {
    radicado: 'PQR-20261106-ABCDEF', name: 'Ana <i>Ruiz</i>', email: 'a@x.co', typeLabel: 'Garantía',
    createdAtLabel: '6 de noviembre de 2026, 7:30 p. m.', dueDateLabel: 'lunes, 30 de noviembre de 2026',
    message: 'La tapa <b>llegó</b> golpeada\nsegunda línea', response: 'Te enviamos uno nuevo.',
  }
  const r = buildPqrReceiptEmail(data, { siteUrl: 'https://pixiaa.com' })
  assert.match(r.subject, /PQR-20261106-ABCDEF/)
  assert.match(r.html, /soporte\/seguimiento\?radicado=PQR-20261106-ABCDEF/)
  assert.match(r.html, /30 de noviembre/)
  assert.doesNotMatch(r.html, /<b>llegó/)
  assert.match(r.html, /golpeada<br>segunda/)
  const resp = buildPqrResponseEmail(data)
  assert.match(resp.text, /Te enviamos uno nuevo/)
  assert.match(resp.html, /sic\.gov\.co/)
})
