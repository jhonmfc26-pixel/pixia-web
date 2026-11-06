/**
 * Tests del portal admin: autenticación (JWT de Cloudflare Access), firma de
 * descargas (compatible con el contenedor) y modelo de pedidos.
 *   npx tsx --test lib/admin/admin.test.ts
 */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { getAdmin, _resetJwksCacheForTests, type AdminAuthConfig } from './auth'
import { buildAdminOrder, computeKpis, needsAttention, pdfStateOf, rangeStart, parseFilters, type OrderRow, type PdfJobRow } from './model'
import { signPdfDownloadUrl } from './data'
import { verifyDownloadToken } from '../../services/pdf-render-container/src/r2'

// ── JWT de prueba firmado con una llave RSA real ────────────────────────────

const TEAM = 'pixia.cloudflareaccess.com'
const AUD = 'aud-123'
const cfg = (over: Partial<AdminAuthConfig> = {}): AdminAuthConfig => ({
  teamDomain: TEAM, audiences: [AUD], emails: ['jhon@pixiaa.com'], allowDevBypass: false, ...over,
})

const b64url = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('base64url')

async function keypair() {
  const kp = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey)
  return { kp, jwk: { kid: 'k1', kty: 'RSA', n: jwk.n!, e: jwk.e! } }
}

async function sign(privateKey: CryptoKey, claims: Record<string, unknown>, kid = 'k1') {
  const h = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', kid })))
  const p = b64url(new TextEncoder().encode(JSON.stringify(claims)))
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${h}.${p}`))
  return `${h}.${p}.${b64url(sig)}`
}

const nowSec = () => Math.floor(Date.now() / 1000)
const good = () => ({ aud: [AUD], iss: `https://${TEAM}`, email: 'Jhon@pixiaa.com', exp: nowSec() + 600 })
const hdr = (token?: string) => new Headers(token ? { 'cf-access-jwt-assertion': token } : {})

beforeEach(() => _resetJwksCacheForTests())

test('auth: JWT válido de un email permitido → entra', async () => {
  const { kp, jwk } = await keypair()
  const admin = await getAdmin(hdr(await sign(kp.privateKey, good())), cfg(), { fetcher: async () => [jwk] })
  assert.deepEqual(admin, { email: 'jhon@pixiaa.com' })
})

test('auth: sin header en producción → no entra; en dev → entra', async () => {
  assert.equal(await getAdmin(hdr(), cfg()), null)
  assert.ok(await getAdmin(hdr(), cfg({ allowDevBypass: true })))
})

test('auth: rechaza firma de otra llave, audiencia, emisor, email y token vencido', async () => {
  const { kp, jwk } = await keypair()
  const other = await keypair()
  const fetcher = async () => [jwk]
  const cases: [string, string][] = [
    ['firma de otra llave', await sign(other.kp.privateKey, good())],
    ['audiencia ajena', await sign(kp.privateKey, { ...good(), aud: ['otra'] })],
    ['emisor ajeno', await sign(kp.privateKey, { ...good(), iss: 'https://evil.cloudflareaccess.com' })],
    ['email no permitido', await sign(kp.privateKey, { ...good(), email: 'intruso@gmail.com' })],
    ['vencido', await sign(kp.privateKey, { ...good(), exp: nowSec() - 10 })],
    ['kid desconocido', await sign(kp.privateKey, good(), 'k-otro')],
    ['basura', 'no.es.unjwt'],
  ]
  for (const [name, token] of cases) {
    _resetJwksCacheForTests()
    assert.equal(await getAdmin(hdr(token), cfg(), { fetcher }), null, name)
  }
})

test('auth: sin CF_ACCESS_AUD igual exige firma del equipo, emisor y email', async () => {
  const { kp, jwk } = await keypair()
  const other = await keypair()
  const fetcher = async () => [jwk]
  const noAud = cfg({ audiences: [] })
  assert.deepEqual(await getAdmin(hdr(await sign(kp.privateKey, { ...good(), aud: ['cualquier-app'] })), noAud, { fetcher }), { email: 'jhon@pixiaa.com' })
  _resetJwksCacheForTests()
  assert.equal(await getAdmin(hdr(await sign(other.kp.privateKey, good())), noAud, { fetcher }), null, 'firma ajena')
  _resetJwksCacheForTests()
  assert.equal(await getAdmin(hdr(await sign(kp.privateKey, { ...good(), email: 'x@y.co' })), noAud, { fetcher }), null, 'email ajeno')
  _resetJwksCacheForTests()
  assert.equal(await getAdmin(hdr(await sign(kp.privateKey, { ...good(), iss: 'https://otro.cloudflareaccess.com' })), noAud, { fetcher }), null, 'emisor ajeno')
})

test('auth: con config incompleta nadie entra (aunque el JWT sea válido)', async () => {
  const { kp, jwk } = await keypair()
  const token = await sign(kp.privateKey, good())
  for (const over of [{ teamDomain: undefined }, { emails: [] }]) {
    _resetJwksCacheForTests()
    assert.equal(await getAdmin(hdr(token), cfg(over), { fetcher: async () => [jwk] }), null)
  }
})

test('auth: si las llaves de Access no responden → no entra', async () => {
  const { kp } = await keypair()
  const admin = await getAdmin(hdr(await sign(kp.privateKey, good())), cfg(), { fetcher: async () => { throw new Error('caído') } })
  assert.equal(admin, null)
})

// ── Firma de descargas ──────────────────────────────────────────────────────

test('descarga: el contenedor acepta la firma del portal', async () => {
  const key = 'album-1/interior/final.pdf'
  const url = new URL((await signPdfDownloadUrl(key, { containerUrl: 'https://ctr.example', secret: 's3cr3t' }))!)
  assert.equal(url.pathname, '/download')
  assert.equal(url.searchParams.get('key'), key)
  assert.ok(verifyDownloadToken('s3cr3t', key, url.searchParams.get('exp')!, url.searchParams.get('sig')!))
  assert.ok(!verifyDownloadToken('otro', key, url.searchParams.get('exp')!, url.searchParams.get('sig')!))
})

test('descarga: sin configuración devuelve null', async () => {
  assert.equal(await signPdfDownloadUrl('k', { containerUrl: '', secret: '' }), null)
})

// ── Modelo ──────────────────────────────────────────────────────────────────

function order(over: Partial<OrderRow> = {}): OrderRow {
  return {
    id: 'o1', reference: 'PIXIA-1', book_id: 'b1', customer_name: 'Ana', customer_email: 'ana@x.co', customer_phone: null,
    shipping_address: null, shipping_city: null, shipping_state: null, shipping_postal_code: null, shipping_notes: null,
    base_price_cop: 250000, pages_included: 20, pages_total: 24, extra_pages_price_cop: 32000, shipping_cop: 10000, total_cop: 292000,
    payment_status: 'approved', print_status: 'paid', wompi_transaction_id: null, wompi_payment_method: null,
    paid_at: '2026-11-03T23:01:00Z', created_at: '2026-11-03T22:55:00Z', ...over,
  }
}
function job(over: Partial<PdfJobRow> = {}): PdfJobRow {
  return {
    blueprint_id: 'b1', order_reference: 'PIXIA-1', status: 'pdf_listo', attempt_count: 1, error_message: null,
    claimed_at: '2026-11-03T23:05:00Z', alerted_at: null, interior_path: 'b1/interior/final.pdf', cover_path: 'b1/cover/final.pdf',
    created_at: '2026-09-01T00:00:00Z', updated_at: '2026-11-03T23:06:47Z', ...over,
  }
}

test('modelo: estados del PDF', () => {
  assert.equal(pdfStateOf(order({ payment_status: 'pending' }), job()), 'no-aplica')
  assert.equal(pdfStateOf(order(), null), 'sin-job')
  assert.equal(pdfStateOf(order(), job({ order_reference: null })), 'sin-job', 'job de prueba dev no cuenta')
  assert.equal(pdfStateOf(order(), job({ order_reference: 'PIXIA-OTRA' })), 'sin-job')
  assert.equal(pdfStateOf(order(), job({ status: 'pendiente' })), 'en-cola')
  assert.equal(pdfStateOf(order(), job({ status: 'error_generacion' })), 'reintentando')
  assert.equal(pdfStateOf(order(), job({ status: 'fallo' })), 'fallo')
  assert.equal(pdfStateOf(order(), job()), 'listo')
})

test('modelo: tiempo pago → PDF (caso real del 3 nov: 5 min 47 s)', () => {
  const o = buildAdminOrder(order(), job(), null)
  assert.equal(o.paidToReadyMs, (5 * 60 + 47) * 1000)
  assert.equal(o.waitingMs, null)
})

test('modelo: atención = fallo, o pagado hace >15 min sin PDF', () => {
  const paid = Date.parse('2026-11-03T23:01:00Z')
  assert.ok(needsAttention(buildAdminOrder(order(), job({ status: 'fallo' }), null, paid + 60_000)))
  assert.ok(!needsAttention(buildAdminOrder(order(), job({ status: 'pendiente' }), null, paid + 10 * 60_000)))
  assert.ok(needsAttention(buildAdminOrder(order(), job({ status: 'pendiente' }), null, paid + 20 * 60_000)))
  assert.ok(!needsAttention(buildAdminOrder(order({ payment_status: 'pending', paid_at: null }), null, null, paid + 99 * 60_000)))
})

test('modelo: KPIs', () => {
  const rows = [
    buildAdminOrder(order(), job(), null),
    buildAdminOrder(order({ id: 'o2', reference: 'PIXIA-2', book_id: 'b2', total_cop: 300000 }), job({ blueprint_id: 'b2', order_reference: 'PIXIA-2', status: 'fallo' }), null),
    buildAdminOrder(order({ id: 'o3', reference: 'PIXIA-3', payment_status: 'pending', paid_at: null }), null, null),
  ]
  const k = computeKpis(rows)
  assert.equal(k.orders, 3)
  assert.equal(k.paid, 2)
  assert.equal(k.revenueCop, 592000)
  assert.equal(k.pdfReady, 1)
  assert.equal(k.pdfFailed, 1)
  assert.ok(k.attention >= 1)
})

test('modelo: "hoy" arranca a medianoche de Colombia', () => {
  // 3 nov 2026, 01:00 en Bogotá = 06:00 UTC → hoy arranca 3 nov 05:00 UTC
  assert.equal(rangeStart('hoy', Date.parse('2026-11-03T06:00:00Z')), '2026-11-03T05:00:00.000Z')
  // 2 nov 23:30 en Bogotá = 3 nov 04:30 UTC → todavía es el 2 en Colombia
  assert.equal(rangeStart('hoy', Date.parse('2026-11-03T04:30:00Z')), '2026-11-02T05:00:00.000Z')
  assert.equal(rangeStart('todo'), null)
})

test('modelo: filtros desconocidos caen en el default', () => {
  assert.deepEqual(parseFilters({ rango: 'xxx', pago: ['pagados'], pdf: 'atencion', q: '  PIXIA ' }),
    { range: '30d', pago: 'pagados', pdf: 'atencion', q: 'PIXIA' })
})
