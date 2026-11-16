/**
 * Revisión de pagos pendientes en el barrido.
 *   npx tsx --test services/pdf-render-container/test/payments.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkPendingPayments, PENDING_MIN_MINUTES, PENDING_MAX_HOURS, MAX_PER_SWEEP } from '../src/payments'
import { runSweep, type RenderEngine } from '../src/queue'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('pregunta por cada pedido pendiente y reporta cómo quedó', async () => {
  const calls: { url: string; method?: string; redirect?: string }[] = []
  let asked: number[] = []
  const r = await checkPendingPayments({
    siteUrl: 'https://pixiaa.com/',
    listPending: async (min, max, limit) => { asked = [min, max, limit]; return ['PIXIA-A-1', 'PIXIA-B-2', 'PIXIA-C-3', 'PIXIA-D-4'] },
    fetchImpl: (async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method, redirect: init.redirect })
      if (url.endsWith('PIXIA-A-1')) return json({ order: { payment_status: 'approved' } })
      if (url.endsWith('PIXIA-B-2')) return json({ order: { payment_status: 'pending' } })
      if (url.endsWith('PIXIA-C-3')) return new Response('', { status: 302, headers: { Location: 'https://pixia.cloudflareaccess.com/' } })
      throw new Error('socket hang up')
    }) as unknown as typeof fetch,
  })
  assert.deepEqual(asked, [PENDING_MIN_MINUTES, PENDING_MAX_HOURS, MAX_PER_SWEEP])
  assert.deepEqual(r, [
    { reference: 'PIXIA-A-1', result: 'approved' },
    { reference: 'PIXIA-B-2', result: 'pending' },
    { reference: 'PIXIA-C-3', result: 'HTTP 302 (¿Cloudflare Access protege /api/orders?)' },
    { reference: 'PIXIA-D-4', result: 'error: socket hang up' },
  ])
  assert.equal(calls[0].url, 'https://pixiaa.com/api/orders/PIXIA-A-1')
  assert.ok(calls.every(c => c.method === 'POST' && c.redirect === 'manual'))
})

function emptyQueue() {
  return {
    reconcileApprovedOrders: async () => [], expireExhausted: async () => [], claimNext: async () => null,
    loadPrintSource: async () => ({}), markInteriorReady: async () => {}, markCoverReady: async () => {},
    markQueueFailure: async () => {}, listUnalertedFailures: async () => [], markAlerted: async () => {},
  }
}
const engine: RenderEngine = {
  renderInterior: async () => ({ pdf: new Uint8Array(), warnings: [] }),
  renderCover: async () => ({ pdf: new Uint8Array(), warnings: [] }),
  upload: async (k) => k,
}

test('el barrido revisa los pagos primero, y si eso falla sigue con lo demás', async () => {
  const order: string[] = []
  const jobs = { ...emptyQueue(), reconcileApprovedOrders: async () => { order.push('reconciliar'); return [] } }
  const ok = await runSweep({ jobs, engine, baseUrl: 'https://assets.pixiaa.com/', checkPayments: async () => { order.push('pagos'); return [{ reference: 'R', result: 'approved' }] } })
  assert.deepEqual(order, ['pagos', 'reconciliar'])
  assert.deepEqual(ok.payments, [{ reference: 'R', result: 'approved' }])

  order.length = 0
  const broken = await runSweep({ jobs, engine, baseUrl: 'https://assets.pixiaa.com/', checkPayments: async () => { throw new Error('Supabase caído') } })
  assert.deepEqual(order, ['reconciliar'])
  assert.deepEqual(broken.payments, [])
})
