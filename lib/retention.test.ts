/**
 *   npx tsx --test lib/retention.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planCleanup, extractPhotoKeys, draftDaysLeft, DAY_MS, type StoredObject, type BlueprintInfo, type OrderInfo } from './retention'

const NOW = new Date('2026-11-10T12:00:00Z')
const ago = (days: number) => new Date(NOW.getTime() - days * DAY_MS)
const CFG = { draftDays: 30, warrantyDays: 30 }
const S1 = '11111111-1111-4111-8111-111111111111'
const S2 = '22222222-2222-4222-8222-222222222222'
const S3 = '33333333-3333-4333-8333-333333333333'
const key = (s: string, p: string) => `users/${s}/original/${p}.jpg`
const obj = (k: string, days: number, size = 1000): StoredObject => ({ key: k, size, lastModified: ago(days) })
const bp = (id: string, days: number, keys: string[]): BlueprintInfo => ({ id, createdAt: ago(days), photoKeys: keys })
const order = (id: string, bookId: string, o: Partial<OrderInfo> = {}): OrderInfo =>
  ({ id, bookId, paymentStatus: 'approved', deliveredAt: null, assetsPurgedAt: null, photoKeys: [], ...o })

test('extrae claves de URLs y JSON', () => {
  const json = { spreads: [{ photos: [{ url: `https://assets.pixiaa.com/${key(S1, 'a')}?v=1` }, { r2Key: key(S1, 'b') }] }] }
  assert.deepEqual(extractPhotoKeys(json).sort(), [key(S1, 'a'), key(S1, 'b')])
  assert.deepEqual(extractPhotoKeys({ url: 'https://assets.pixiaa.com/logo-pixia.png' }), [])
})

test('borrador de menos de 30 días: se guarda; de más: se borra con sus fotos', () => {
  const plan = planCleanup({
    blueprints: [bp('nuevo', 10, [key(S1, 'a')]), bp('viejo', 45, [key(S2, 'b')])],
    orders: [], pdfs: [],
    photos: [obj(key(S1, 'a'), 10), obj(key(S2, 'b'), 45)],
  }, NOW, CFG)
  assert.deepEqual(plan.deleteBlueprintIds, ['viejo'])
  assert.deepEqual(plan.deletePhotos.map(o => o.key), [key(S2, 'b')])
})

test('nunca se borra una foto de menos de 30 días, aunque nada la referencie (borradores anónimos)', () => {
  const plan = planCleanup({ blueprints: [], orders: [], pdfs: [], photos: [obj(key(S1, 'a'), 29), obj(key(S2, 'b'), 31)] }, NOW, CFG)
  assert.deepEqual(plan.deletePhotos.map(o => o.key), [key(S2, 'b')])
})

test('pedido pagado sin entregar: todo se guarda, aunque el álbum tenga meses', () => {
  const plan = planCleanup({
    blueprints: [bp('comprado', 120, [key(S1, 'a')])],
    orders: [order('o1', 'comprado', { photoKeys: [key(S1, 'a')] })],
    photos: [obj(key(S1, 'a'), 120)],
    pdfs: [obj('comprado/interior/final.pdf', 100), obj('comprado/cover/final.pdf', 100)],
  }, NOW, CFG)
  assert.equal(plan.deletePhotos.length, 0)
  assert.equal(plan.deletePdfs.length, 0)
  assert.deepEqual(plan.deleteBlueprintIds, [])
})

test('entregado hace menos de 30 días: se guarda; hace más: se borran fotos y PDF, la fila queda', () => {
  const base = {
    blueprints: [bp('a1', 90, [key(S1, 'a')]), bp('a2', 90, [key(S2, 'b')])],
    photos: [obj(key(S1, 'a'), 90), obj(key(S2, 'b'), 90)],
    pdfs: [obj('a1/interior/final.pdf', 80), obj('a2/interior/final.pdf', 80)],
  }
  const plan = planCleanup({
    ...base,
    orders: [
      order('o1', 'a1', { deliveredAt: ago(10), photoKeys: [key(S1, 'a')] }),
      order('o2', 'a2', { deliveredAt: ago(40), photoKeys: [key(S2, 'b')] }),
    ],
  }, NOW, CFG)
  assert.deepEqual(plan.deletePhotos.map(o => o.key), [key(S2, 'b')])
  assert.deepEqual(plan.deletePdfs.map(o => o.key), ['a2/interior/final.pdf'])
  assert.deepEqual(plan.purgeOrderIds, ['o2'])
  assert.deepEqual(plan.deleteBlueprintIds, [], 'la fila de un álbum comprado nunca se borra')
})

test('un pedido no pagado no protege: el álbum se trata como borrador', () => {
  const plan = planCleanup({
    blueprints: [bp('b', 40, [key(S1, 'a')])],
    orders: [order('o', 'b', { paymentStatus: 'pending', photoKeys: [key(S1, 'a')] })],
    photos: [obj(key(S1, 'a'), 40)], pdfs: [],
  }, NOW, CFG)
  assert.deepEqual(plan.deleteBlueprintIds, ['b'])
  assert.equal(plan.deletePhotos.length, 1)
})

test('red de seguridad: una foto vieja en la carpeta de un álbum vigente se guarda aunque no esté referenciada', () => {
  const plan = planCleanup({
    blueprints: [bp('vigente', 5, [key(S1, 'nueva')])],
    orders: [], pdfs: [],
    photos: [obj(key(S1, 'nueva'), 5), obj(key(S1, 'vieja-sin-referencia'), 60), obj(key(S3, 'otra'), 60)],
  }, NOW, CFG)
  assert.deepEqual(plan.deletePhotos.map(o => o.key), [key(S3, 'otra')])
})

test('nunca toca nada fuera de users/ (logo, fotos de la home)', () => {
  const plan = planCleanup({ blueprints: [], orders: [], pdfs: [], photos: [obj('logo-pixia.png', 400), obj('showcase/playa.jpg', 400)] }, NOW, CFG)
  assert.equal(plan.deletePhotos.length, 0)
})

test('pedido ya purgado no se vuelve a marcar', () => {
  const plan = planCleanup({
    blueprints: [], photos: [], pdfs: [],
    orders: [order('o', 'x', { deliveredAt: ago(60), assetsPurgedAt: ago(20) })],
  }, NOW, CFG)
  assert.deepEqual(plan.purgeOrderIds, [])
})

test('contador del borrador', () => {
  assert.equal(draftDaysLeft(ago(0), NOW, 30), 30)
  assert.equal(draftDaysLeft(ago(18.2), NOW, 30), 12)
  assert.ok(draftDaysLeft(ago(31), NOW, 30) <= 0)
})
