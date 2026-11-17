/**
 *   npx tsx --test lib/safeEqual.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeEqual } from './safeEqual'

test('compara igual que ===, sin cortar en el primer carácter distinto', () => {
  assert.equal(safeEqual('abc123', 'abc123'), true)
  assert.equal(safeEqual('abc123', 'abc124'), false)
  assert.equal(safeEqual('abc', 'abc1'), false)
  assert.equal(safeEqual('abc1', 'abc'), false)
  assert.equal(safeEqual('', ''), true)
  assert.equal(safeEqual('ñandú', 'ñandú'), true)
  assert.equal(safeEqual('ñandú', 'nandu'), false)
  assert.equal(safeEqual(undefined, ''), false)
  assert.equal(safeEqual(null, null), false)
  assert.equal(safeEqual('a', undefined), false)
})
