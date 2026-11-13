/**
 * Protecciones del PDF de impresión que no necesitan Chromium:
 * dominios permitidos, mensaje de recursos que no cargaron y fotos sin subir.
 *
 * Correr desde la raíz de pixia-web:
 *   npx tsx --test services/pdf-render-container/test/printGuards.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allowedPrintHosts, isAllowedPrintUrl } from '../src/printHosts'
import { describeFailedResources } from '../src/renderAlbum'
import { runSweep, type RenderEngine } from '../src/queue'
import type { QueueJob } from '../src/jobs'
import type { buildPrintJobInput } from '@/core/modules/print/buildPrintJobInput'

test('solo se descarga del almacenamiento de Pixia y de Google Fonts', () => {
  const hosts = allowedPrintHosts('https://assets.pixiaa.com/', '')
  for (const ok of [
    'https://assets.pixiaa.com/users/s/original/p.jpg',
    'https://assets.pixiaa.com/logo-pixia.png',
    'https://fonts.googleapis.com/css2?family=Inter',
    'https://fonts.gstatic.com/s/inter/v1/x.woff2',
    'data:image/png;base64,AAAA',
    'about:blank',
  ]) assert.equal(isAllowedPrintUrl(ok, hosts), true, ok)
  for (const bad of [
    'https://servidor-ajeno.example/x.jpg',
    'http://assets.pixiaa.com/x.jpg',               // sin https
    'https://assets.pixiaa.com.evil.example/x.jpg', // parece, pero no es
    'http://169.254.169.254/computeMetadata/v1/',   // metadatos de la nube
    'http://localhost:8080/',
    'file:///etc/passwd',
    'no es una url',
  ]) assert.equal(isAllowedPrintUrl(bad, hosts), false, bad)
})

test('el dominio de PRINT_BASE_URL y los de PRINT_EXTRA_HOSTS también se permiten', () => {
  const hosts = allowedPrintHosts('https://cdn.otro.co/base/', ' fotos.pixiaa.com , IMG.Ejemplo.com ')
  assert.equal(isAllowedPrintUrl('https://cdn.otro.co/a.jpg', hosts), true)
  assert.equal(isAllowedPrintUrl('https://fotos.pixiaa.com/a.jpg', hosts), true)
  assert.equal(isAllowedPrintUrl('https://img.ejemplo.com/a.jpg', hosts), true)
  assert.equal(isAllowedPrintUrl('https://assets.pixiaa.com/a.jpg', hosts), true) // el de Pixia siempre
  // Una base inválida no rompe: quedan los fijos.
  assert.equal(isAllowedPrintUrl('https://assets.pixiaa.com/a.jpg', allowedPrintHosts('no-es-url', undefined)), true)
})

test('el error dice qué no cargó, sin volcar direcciones enormes', () => {
  const one = describeFailedResources(new Map([['https://assets.pixiaa.com/users/s/original/p7.jpg', 'HTTP 404']]))
  assert.equal(one, 'No cargó 1 foto o fuente del álbum, no se genera el PDF: https://assets.pixiaa.com/users/s/original/p7.jpg (HTTP 404)')
  const many = describeFailedResources(new Map(Array.from({ length: 8 }, (_, i) => [`https://x/${i}.jpg`, 'no cargó'] as [string, string])))
  assert.match(many, /^No cargaron 8 fotos o fuentes/)
  assert.match(many, /y 3 más$/)
  const data = describeFailedResources(new Map([[`data:image/jpeg;base64,${'A'.repeat(5000)}`, 'imagen rota'], ['', 'imagen sin dirección']]))
  assert.ok(data.length < 400, `mensaje de ${data.length} caracteres`)
  assert.match(data, /\(sin dirección\) \(imagen sin dirección\)/)
})

test('un álbum con fotos sin subir no se imprime: falla definitiva, sin reintentos ni PDF', async () => {
  const job: QueueJob = { blueprint_id: 'album-1', order_reference: 'ORD-1', status: 'generando_pdf', attempt_count: 1, error_message: null, claimed_at: new Date().toISOString() }
  const face = (id: string, photoIds: string[]) => ({ id, layout: 'single', photoIds })
  const build: typeof buildPrintJobInput = () => ({
    ok: true, warnings: [],
    input: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      structure: { folds: [{ id: 'f1', kind: 'paired', left: face('l', ['p1']), right: face('r', ['p2']) }] } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      photos: { p1: { id: 'p1', url: 'https://assets.pixiaa.com/users/s/original/p1.jpg' }, p2: { id: 'p2', url: 'data:image/jpeg;base64,AAAA' } } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cover: { photoId: '', title: 'x', kind: 'graphic' } as any, coverPhoto: undefined, format: '30x30',
    },
  })
  const queue = [job]
  const failures: { msg: string; final: boolean }[] = []
  let rendered = 0
  const engine: RenderEngine = {
    renderInterior: async () => { rendered++; return { pdf: new Uint8Array([1]), warnings: [] } },
    renderCover: async () => { rendered++; return { pdf: new Uint8Array([2]), warnings: [] } },
    upload: async (key) => key,
  }
  const jobs = {
    reconcileApprovedOrders: async () => [], expireExhausted: async () => [], claimNext: async () => queue.shift() ?? null,
    loadBlueprint: async () => ({}), loadPrintSource: async () => ({}),
    markInteriorReady: async () => {}, markCoverReady: async () => {},
    markQueueFailure: async (_id: string, msg: string, final: boolean) => { failures.push({ msg, final }) },
    listUnalertedFailures: async () => [], markAlerted: async () => {},
  }
  const r = await runSweep({ jobs, engine, baseUrl: 'https://assets.pixiaa.com/', build, alert: async () => true })
  assert.equal(r.processed[0].ok, false)
  assert.equal(rendered, 0)
  assert.equal(failures.length, 1)
  assert.equal(failures[0].final, true)
  assert.match(failures[0].msg, /^Una foto del álbum no se puede imprimir: p2 \(interior: no terminó de subir\)/)
})
