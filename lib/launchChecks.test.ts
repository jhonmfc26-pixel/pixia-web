/**
 *   npx tsx --test lib/launchChecks.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { launchChecks, MANUAL_STEPS } from './launchChecks'
import { wompiSetup, wompiApiUrl, WOMPI_PRODUCTION_URL, WOMPI_SANDBOX_URL } from './wompiConfig'

const PROD = { NEXT_PUBLIC_WOMPI_PUBLIC_KEY: 'pub_prod_abc', WOMPI_PRIVATE_KEY: 'prv_prod_abc', WOMPI_EVENTS_SECRET: 'prod_events_abc', WOMPI_INTEGRITY_SECRET: 'prod_integrity_abc' }
const TEST = { NEXT_PUBLIC_WOMPI_PUBLIC_KEY: 'pub_test_abc', WOMPI_PRIVATE_KEY: 'prv_test_abc', WOMPI_EVENTS_SECRET: 'test_events_abc', WOMPI_INTEGRITY_SECRET: 'test_integrity_abc' }

test('Wompi: cuatro llaves del mismo ambiente', () => {
  assert.deepEqual(wompiSetup(PROD), { mode: 'produccion', problems: [] })
  assert.deepEqual(wompiSetup(TEST), { mode: 'pruebas', problems: [] })
})

test('Wompi: la API que se consulta sigue a la llave privada, salvo que WOMPI_API_URL diga otra cosa', () => {
  assert.equal(wompiApiUrl(PROD), WOMPI_PRODUCTION_URL)
  assert.equal(wompiApiUrl(TEST), WOMPI_SANDBOX_URL)
  assert.equal(wompiApiUrl({}), WOMPI_SANDBOX_URL)
  assert.equal(wompiApiUrl({ ...PROD, WOMPI_API_URL: ' https://otra.wompi.co/v1/ ' }), 'https://otra.wompi.co/v1')
})

test('Wompi: llaves mezcladas, faltantes o con la API del otro ambiente', () => {
  const mixed = wompiSetup({ ...PROD, WOMPI_EVENTS_SECRET: 'test_events_abc' })
  assert.equal(mixed.mode, 'mal')
  assert.match(mixed.problems.join(' '), /mezcladas.*De pruebas: WOMPI_EVENTS_SECRET/)

  const missing = wompiSetup({ ...PROD, WOMPI_INTEGRITY_SECRET: '  ' })
  assert.equal(missing.mode, 'mal')
  assert.match(missing.problems[0], /Falta WOMPI_INTEGRITY_SECRET/)

  const wrongApi = wompiSetup({ ...PROD, WOMPI_API_URL: WOMPI_SANDBOX_URL })
  assert.equal(wrongApi.mode, 'mal')
  assert.match(wrongApi.problems[0], /apunta a sandbox pero las llaves son de producción/)

  const swapped = wompiSetup({ ...PROD, WOMPI_PRIVATE_KEY: 'pub_prod_abc' }) // pegó la pública donde va la privada
  assert.equal(swapped.mode, 'mal')
  assert.match(swapped.problems[0], /WOMPI_PRIVATE_KEY no parece una llave privada/)

  assert.equal(wompiSetup({}).problems.length, 4)
})

test('Wompi: los mensajes nunca incluyen el valor de una llave', () => {
  const secret = 'prv_prod_SUPERSECRETO123'
  const all = [wompiSetup({ ...TEST, WOMPI_PRIVATE_KEY: secret }), wompiSetup({ WOMPI_PRIVATE_KEY: secret })]
  for (const s of all) assert.ok(!s.problems.join(' ').includes('SUPERSECRETO'))
  const text = JSON.stringify(launchChecks({ ...PROD, WOMPI_PRIVATE_KEY: secret, RESEND_API_KEY: 're_SECRETO', SUPABASE_SERVICE_ROLE_KEY: 'SECRETO2' }))
  assert.ok(!/SUPERSECRETO|re_SECRETO|SECRETO2/.test(text))
})

const READY_ENV = {
  ...PROD, RESEND_API_KEY: 're_x', EMAIL_FROM: 'Pixia <hola@pixiaa.com>', ALERT_EMAIL: 'jhon@pixiaa.com', EMAIL_SUPPORT: 'soporte@pixiaa.com',
  R2_ENDPOINT: 'x', R2_BUCKET: 'x', R2_ACCESS_KEY_ID: 'x', R2_SECRET_ACCESS_KEY: 'x', NEXT_PUBLIC_R2_PUBLIC_URL: 'https://assets.pixiaa.com',
  PDF_CONTAINER_URL: 'https://x.run.app', PDF_CONTAINER_SECRET: 'x', CF_ACCESS_TEAM_DOMAIN: 'pixia.cloudflareaccess.com', ADMIN_EMAILS: 'jhon@pixiaa.com', CF_ACCESS_AUD: 'aud',
  NEXT_PUBLIC_SITE_URL: 'https://pixiaa.com', NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x', SUPABASE_SERVICE_ROLE_KEY: 'x',
}
const READY_LEGAL = { brand: 'Pixia', legalName: 'Jhon Ejemplo', taxId: '123456789-0', address: 'Calle 1', city: 'Bogotá', phone: '3000000000', email: 'soporte@pixiaa.com' }

test('todo configurado: todo en «ok»', () => {
  const checks = launchChecks(READY_ENV, READY_LEGAL)
  assert.deepEqual(checks.filter(c => c.status !== 'ok'), [])
  assert.deepEqual([...new Set(checks.map(c => c.group))], ['Pagos', 'Correos', 'Datos legales', 'Fotos y PDF', 'Admin', 'Sitio'])
})

test('antes del lanzamiento: sandbox es un aviso; datos legales pendientes y remitente de prueba bloquean', () => {
  const checks = launchChecks({ ...READY_ENV, ...TEST, EMAIL_FROM: undefined, EMAIL_SUPPORT: undefined, CF_ACCESS_AUD: undefined },
    { ...READY_LEGAL, taxId: '[PENDIENTE: NIT o cédula (RUT)]', phone: '[PENDIENTE: teléfono / WhatsApp]' })
  const by = (label: string) => checks.find(c => c.label === label)!
  assert.equal(by('Wompi en modo de pruebas').status, 'aviso')
  assert.equal(by('Remitente de los correos').status, 'falta')
  assert.match(by('Remitente de los correos').detail, /onboarding@resend\.dev/)
  assert.equal(by('Correo de soporte').status, 'aviso')
  assert.equal(by('Acceso al admin').status, 'aviso')
  assert.equal(by('Datos del vendedor').status, 'falta')
  assert.match(by('Datos del vendedor').detail, /NIT o cédula, teléfono/)
})

test('sin nada configurado: cada grupo dice qué falta, sin romperse', () => {
  const checks = launchChecks({}, READY_LEGAL)
  const faltan = checks.filter(c => c.status === 'falta').map(c => c.label)
  assert.deepEqual(faltan, ['Wompi mal configurado', 'Envío de correos', 'Avisos internos', 'Almacenamiento de fotos', 'Conexión con el generador de PDF', 'Acceso al admin', 'Base de datos y cuentas'])
})

test('la lista manual incluye la URL de eventos de Wompi', () => {
  assert.ok(MANUAL_STEPS.some(s => s.detail.includes('https://pixiaa.com/api/orders/webhook')))
})
