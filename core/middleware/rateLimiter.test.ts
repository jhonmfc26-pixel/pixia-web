/**
 *   npx tsx --test core/middleware/rateLimiter.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRateLimit } from './rateLimiter'

function fakeKV(opts: { failPut?: boolean; failGet?: boolean } = {}) {
  const data = new Map<string, string>()
  let puts = 0
  return {
    data,
    get puts() { return puts },
    get: async (k: string) => { if (opts.failGet) throw new Error('KV GET failed: 500'); return data.get(k) ?? null },
    put: async (k: string, v: string) => { if (opts.failPut) throw new Error('KV PUT failed: 429 Too Many Requests'); puts++; data.set(k, v) },
  }
}
const T0 = 1_800_000_000_000

test('pagos: deja pasar 10 por minuto y bloquea el 11', async () => {
  const kv = fakeKV()
  for (let i = 0; i < 10; i++) assert.equal(await checkRateLimit(kv, '1.1.1.1', '/api/orders', { now: T0 }), null)
  const blocked = await checkRateLimit(kv, '1.1.1.1', '/api/orders', { now: T0 })
  assert.equal(blocked?.status, 429)
  // Otra IP no se ve afectada.
  assert.equal(await checkRateLimit(kv, '2.2.2.2', '/api/orders', { now: T0 }), null)
})

test('el contador se reinicia al minuto siguiente aunque sigan llegando peticiones', async () => {
  const kv = fakeKV()
  for (let i = 0; i < 11; i++) await checkRateLimit(kv, '1.1.1.1', '/api/orders', { now: T0 })
  assert.equal((await checkRateLimit(kv, '1.1.1.1', '/api/orders', { now: T0 + 30_000 }))?.status, 429)
  assert.equal(await checkRateLimit(kv, '1.1.1.1', '/api/orders', { now: T0 + 61_000 }), null)
})

test('si KV falla al escribir o al leer, la petición pasa', async () => {
  assert.equal(await checkRateLimit(fakeKV({ failPut: true }), '1.1.1.1', '/api/upload', { now: T0, random: () => 0 }), null)
  assert.equal(await checkRateLimit(fakeKV({ failPut: true }), '1.1.1.1', '/api/orders', { now: T0 }), null)
  assert.equal(await checkRateLimit(fakeKV({ failGet: true }), '1.1.1.1', '/api/orders', { now: T0 }), null)
})

test('subida: un álbum de 100 fotos pasa completo con pocas escrituras en KV', async () => {
  const kv = fakeKV()
  let n = 0
  const random = () => (n++ % 10) / 10 // 1 de cada 10 cuenta
  for (let i = 0; i < 100; i++) assert.equal(await checkRateLimit(kv, '1.1.1.1', '/api/upload', { now: T0, random }), null)
  assert.equal(kv.puts, 10)
})

test('subida: un abuso de miles de peticiones por minuto sí se bloquea', async () => {
  const kv = fakeKV()
  let n = 0
  const random = () => (n++ % 10) / 10
  let blocked = 0
  for (let i = 0; i < 2000; i++) if (await checkRateLimit(kv, '1.1.1.1', '/api/upload', { now: T0, random })) blocked++
  assert.ok(blocked > 1300, `bloqueadas: ${blocked}`)
  assert.ok(kv.puts <= 60, `escrituras: ${kv.puts}`)
})
