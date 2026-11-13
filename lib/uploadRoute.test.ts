/**
 * /api/upload contra un R2 de mentira (a nivel de fetch).
 *
 *   npx tsx --test lib/uploadRoute.test.ts
 */
import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

process.env.R2_ENDPOINT = 'https://r2.test'
process.env.R2_BUCKET = 'fotos'
process.env.R2_ACCESS_KEY_ID = 'k'.repeat(32)
process.env.R2_SECRET_ACCESS_KEY = 's'.repeat(64)
process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'https://assets.test'

const SESSION = '11111111-1111-4111-8111-111111111111'
const PHOTO = '22222222-2222-4222-8222-222222222222'
const jpeg = (fill: number) => new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(60).fill(fill)])

/** Objetos guardados: clave → primer byte de relleno (para saber cuál versión quedó). */
const bucket = new Map<string, number>()
const puts: { key: string; conditional: boolean }[] = []
/** Cómo responde R2 a una subida condicional: normal, o rechazándola (para probar el respaldo). */
let conditionalMode: 'ok' | 'rejected' = 'ok'

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input))
  assert.equal(url.host, 'r2.test', `fetch inesperado: ${url}`)
  const key = url.pathname.replace('/fotos/', '')
  const headers = new Headers(init?.headers)
  const conditional = headers.get('if-none-match') === '*'
  puts.push({ key, conditional })
  assert.match(headers.get('authorization') ?? '', /^AWS4-HMAC-SHA256 /)
  if (conditional && conditionalMode === 'rejected') return new Response('<Error><Code>NotImplemented</Code></Error>', { status: 400 })
  if (conditional && bucket.has(key)) return new Response('<Error><Code>PreconditionFailed</Code></Error>', { status: 412 })
  bucket.set(key, new Uint8Array(init!.body as ArrayBuffer)[10])
  return new Response('', { status: 200 })
}) as typeof fetch

let upload: (req: NextRequest) => Promise<Response>
before(async () => { upload = (await import('@/app/api/upload/route')).POST })
beforeEach(() => { bucket.clear(); puts.length = 0; conditionalMode = 'ok' })

async function send(fields: { photoId?: string; sessionId?: string; fill?: number; display?: number; file?: Uint8Array<ArrayBuffer> }) {
  const form = new FormData()
  form.append('file', new Blob([fields.file ?? jpeg(fields.fill ?? 1)]), 'foto.jpg')
  form.append('sessionId', fields.sessionId ?? SESSION)
  form.append('photoId', fields.photoId ?? PHOTO)
  if (fields.display !== undefined) form.append('display', new Blob([jpeg(fields.display)]), 'display.jpg')
  const res = await upload(new NextRequest('https://pixiaa.com/api/upload', { method: 'POST', body: form }))
  return { status: res.status, body: await res.json() as Record<string, string> }
}
const original = `users/${SESSION}/original/${PHOTO}.jpg`
const display = `users/${SESSION}/display/${PHOTO}.jpg`

test('sube la foto y su versión liviana', async () => {
  const r = await send({ fill: 1, display: 2 })
  assert.equal(r.status, 200)
  assert.equal(r.body.url, `https://assets.test/${original}`)
  assert.equal(r.body.displayUrl, `https://assets.test/${display}`)
  assert.deepEqual([bucket.get(original), bucket.get(display)], [1, 2])
  assert.ok(puts.every(p => p.conditional))
})

test('A2 · una foto ya subida no se puede reemplazar por otra', async () => {
  await send({ fill: 1, display: 2 })
  const again = await send({ fill: 9, display: 9 }) // otra imagen, mismo id
  // Para un reintento legítimo es un éxito: devuelve la que ya estaba.
  assert.equal(again.status, 200)
  assert.equal(again.body.url, `https://assets.test/${original}`)
  assert.equal(again.body.displayUrl, `https://assets.test/${display}`)
  assert.deepEqual([bucket.get(original), bucket.get(display)], [1, 2])
})

test('ids que no son seguros para una ruta de archivo se rechazan', async () => {
  for (const photoId of ['../../covers/x', 'a/b', 'a.b', 'con espacio', 'x'.repeat(65), '%2e%2e']) {
    assert.equal((await send({ photoId })).status, 400, photoId)
  }
  assert.equal((await send({ sessionId: 'no-es-uuid' })).status, 400)
  assert.equal(puts.length, 0)
})

test('un archivo que no es imagen se rechaza', async () => {
  const r = await send({ file: new TextEncoder().encode('<script>alert(1)</script> relleno') })
  assert.equal(r.status, 415)
  assert.equal(bucket.size, 0)
})

test('si R2 rechazara la subida condicional, la foto igual sube (y queda en los logs)', async () => {
  conditionalMode = 'rejected'
  const r = await send({ fill: 3 })
  assert.equal(r.status, 200)
  assert.equal(bucket.get(original), 3)
  assert.deepEqual(puts.filter(p => p.key === original).map(p => p.conditional), [true, false])
})
