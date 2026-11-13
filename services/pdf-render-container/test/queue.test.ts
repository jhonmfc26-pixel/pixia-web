/**
 * Tests de la lógica de la cola pagado → PDF (sin Chromium, sin Supabase):
 * todo lo externo se reemplaza por fakes en memoria.
 *
 * Correr desde la raíz de pixia-web:
 *   npx tsx --test services/pdf-render-container/test/queue.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runSweep, MAX_ATTEMPTS, type RenderEngine } from '../src/queue'
import { findOrdersMissingJob, type QueueJob } from '../src/jobs'
import type { buildPrintJobInput } from '@/core/modules/print/buildPrintJobInput'

type Build = typeof buildPrintJobInput

function job(overrides: Partial<QueueJob> = {}): QueueJob {
  return { blueprint_id: 'album-1', order_reference: 'ORD-1', status: 'generando_pdf', attempt_count: 1, error_message: null, claimed_at: new Date().toISOString(), ...overrides }
}

const okBuild: Build = () => ({
  ok: true,
  warnings: [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: { structure: { folds: [{}] } as any, photos: {}, cover: {} as any, coverPhoto: undefined, format: '30x30' },
})

function fakeEngine(opts: { failInterior?: string } = {}): RenderEngine & { uploads: string[] } {
  const uploads: string[] = []
  return {
    uploads,
    renderInterior: async () => {
      if (opts.failInterior) throw new Error(opts.failInterior)
      return { pdf: new Uint8Array([1]), warnings: [] }
    },
    renderCover: async () => ({ pdf: new Uint8Array([2]), warnings: [] }),
    upload: async (key) => { uploads.push(key); return key },
  }
}

/** Cola en memoria: claimNext entrega los jobs de `queue` en orden. */
function fakeJobs(queue: QueueJob[], extra: { failures?: QueueJob[]; reconcileThrows?: boolean } = {}) {
  const calls = { loaded: [] as { id: string; order: string | null }[], interiorReady: [] as string[], coverReady: [] as string[], failures: [] as { id: string; msg: string; final: boolean }[], alerted: [] as string[] }
  const failed: QueueJob[] = [...(extra.failures ?? [])]
  return {
    calls,
    jobs: {
      reconcileApprovedOrders: async () => { if (extra.reconcileThrows) throw new Error('db caída'); return [] },
      expireExhausted: async () => [],
      claimNext: async () => queue.shift() ?? null,
      loadPrintSource: async (id: string, order: string | null) => { calls.loaded.push({ id, order }); return {} },
      markInteriorReady: async (id: string) => { calls.interiorReady.push(id) },
      markCoverReady: async (id: string) => { calls.coverReady.push(id) },
      markQueueFailure: async (id: string, msg: string, final: boolean) => {
        calls.failures.push({ id, msg, final })
        if (final) failed.push(job({ blueprint_id: id, status: 'fallo', error_message: msg }))
      },
      listUnalertedFailures: async () => failed.filter((f) => !calls.alerted.includes(f.blueprint_id)),
      markAlerted: async (id: string) => { calls.alerted.push(id) },
    },
  }
}

test('job sano: genera interior + cubierta, sube a R2 y no alerta', async () => {
  const { jobs, calls } = fakeJobs([job()])
  const engine = fakeEngine()
  const alerts: QueueJob[] = []
  const r = await runSweep({ jobs, engine, baseUrl: 'x', build: okBuild, alert: async (j) => { alerts.push(j); return true } })
  assert.deepEqual(r.processed, [{ order: 'ORD-1', albumId: 'album-1', ok: true }])
  assert.deepEqual(engine.uploads, ['album-1/interior/final.pdf', 'album-1/cover/final.pdf'])
  assert.deepEqual(calls.interiorReady, ['album-1'])
  assert.deepEqual(calls.coverReady, ['album-1'])
  assert.equal(alerts.length, 0)
  // El álbum se pide con su orden: se imprime la copia que se cobró.
  assert.deepEqual(calls.loaded, [{ id: 'album-1', order: 'ORD-1' }])
})

test('falla en un intento intermedio: queda para reintento, sin alerta', async () => {
  const { jobs, calls } = fakeJobs([job({ attempt_count: 1 })])
  const alerts: QueueJob[] = []
  const r = await runSweep({ jobs, engine: fakeEngine({ failInterior: 'timeout chromium' }), baseUrl: 'x', build: okBuild, alert: async (j) => { alerts.push(j); return true } })
  assert.equal(r.processed[0].ok, false)
  assert.deepEqual(calls.failures, [{ id: 'album-1', msg: 'timeout chromium', final: false }])
  assert.equal(alerts.length, 0)
})

test('falla en el último intento: pasa a fallo y alerta en el mismo barrido', async () => {
  const { jobs, calls } = fakeJobs([job({ attempt_count: MAX_ATTEMPTS })])
  const alerts: QueueJob[] = []
  const r = await runSweep({ jobs, engine: fakeEngine({ failInterior: 'OOM' }), baseUrl: 'x', build: okBuild, alert: async (j) => { alerts.push(j); return true } })
  assert.equal(calls.failures[0].final, true)
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].blueprint_id, 'album-1')
  assert.deepEqual(calls.alerted, ['album-1'])
  assert.equal(r.alertsSent, 1)
})

test('álbum sin pliegos: fallo definitivo al primer intento (reintentar no lo arregla)', async () => {
  const { jobs, calls } = fakeJobs([job({ attempt_count: 1 })])
  const noFolds: Build = () => ({ ok: false, reason: 'sin pliegos' })
  await runSweep({ jobs, engine: fakeEngine(), baseUrl: 'x', build: noFolds, alert: async () => true })
  assert.deepEqual(calls.failures, [{ id: 'album-1', msg: 'sin pliegos', final: true }])
  assert.deepEqual(calls.alerted, ['album-1'])
})

test('si Resend falla, NO se marca alertada (se reintenta en el próximo barrido)', async () => {
  const { jobs, calls } = fakeJobs([], { failures: [job({ status: 'fallo', error_message: 'x' })] })
  const r = await runSweep({ jobs, engine: fakeEngine(), baseUrl: 'x', build: okBuild, alert: async () => false })
  assert.equal(r.alertsFailed, 1)
  assert.deepEqual(calls.alerted, [])
})

test('un error en reconcile no frena el procesamiento', async () => {
  const { jobs } = fakeJobs([job()], { reconcileThrows: true })
  const r = await runSweep({ jobs, engine: fakeEngine(), baseUrl: 'x', build: okBuild, alert: async () => true })
  assert.equal(r.processed.length, 1)
  assert.equal(r.processed[0].ok, true)
})

test('respeta el máximo de jobs por barrido', async () => {
  const many = Array.from({ length: 12 }, (_, i) => job({ blueprint_id: `a${i}`, order_reference: `O${i}` }))
  const { jobs } = fakeJobs(many)
  const r = await runSweep({ jobs, engine: fakeEngine(), baseUrl: 'x', build: okBuild, alert: async () => true })
  assert.equal(r.processed.length, 5)
})

test('respeta el presupuesto de tiempo', async () => {
  let t = 0
  const { jobs } = fakeJobs([job({ blueprint_id: 'a' }), job({ blueprint_id: 'b' })])
  const engine = fakeEngine()
  const slow: RenderEngine = { ...engine, renderInterior: async (...args) => { t += 4 * 60 * 1000; return engine.renderInterior(...args) } }
  const r = await runSweep({ jobs, engine: slow, baseUrl: 'x', build: okBuild, alert: async () => true, now: () => t })
  assert.equal(r.processed.length, 1)
})

test('reconcile: encola órdenes sin job o con job de prueba dev; no pisa jobs de otra orden', () => {
  const orders = [
    { reference: 'A', book_id: 'b1' }, // sin job → encolar
    { reference: 'B', book_id: 'b2' }, // job de esta orden → nada
    { reference: 'C', book_id: 'b3' }, // job de prueba dev (sin orden) → encolar
    { reference: 'D', book_id: 'b4' }, // job de OTRA orden → no tocar
  ]
  const jobsByBook = new Map<string, string | null>([['b2', 'B'], ['b3', null], ['b4', 'Z']])
  assert.deepEqual(findOrdersMissingJob(orders, jobsByBook).map((o) => o.reference), ['A', 'C'])
})

test('reconcile: un álbum con dos pagos y sin job encola solo el primero', () => {
  const orders = [
    { reference: 'PRIMERO', book_id: 'b1' },
    { reference: 'SEGUNDO', book_id: 'b1' },
  ]
  assert.deepEqual(findOrdersMissingJob(orders, new Map()).map((o) => o.reference), ['PRIMERO'])
})
