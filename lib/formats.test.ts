/**
 *   npx tsx --test lib/formats.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FORMATS, formatOfBook, getFormat, idealFormat, suggestedFormat, shortSize } from './formats'
import { calculateOrderTotal } from './wompi'

test('solo 3 formatos, con los precios definidos', () => {
  assert.equal(FORMATS.length, 3)
  assert.deepEqual(FORMATS.map(f => [f.id, f.priceCop]), [['30x30', 280_000], ['20x20', 200_000], ['21x28', 230_000]])
})

test('tamaño sugerido por momento', () => {
  assert.equal(suggestedFormat('wedding').id, '30x30')
  assert.equal(suggestedFormat('anniversary').id, '30x30')
  assert.equal(suggestedFormat('kids').id, '20x20')
  assert.equal(suggestedFormat('other').id, '30x30')
  assert.equal(suggestedFormat(undefined).id, '30x30')
  // Viajes: el ideal es el vertical; mientras no se venda, se sugiere el grande.
  assert.equal(idealFormat('trip').id, '21x28')
  assert.equal(suggestedFormat('trip').id, getFormat('21x28').available ? '21x28' : '30x30')
})

test('formato de un álbum guardado', () => {
  assert.equal(formatOfBook(undefined).id, '30x30') // álbumes anteriores
  assert.equal(formatOfBook('30x30').id, '30x30')
  assert.equal(formatOfBook('20x20').id, '20x20')
  assert.equal(formatOfBook('a4').id, '21x28')
  assert.equal(formatOfBook('square').id, '30x30')
  assert.equal(shortSize(formatOfBook('20x20')), '20×20')
})

test('el cobro usa el precio del formato', () => {
  assert.equal(calculateOrderTotal(20).totalCop, 280_000)
  assert.equal(calculateOrderTotal(20, '20x20').totalCop, 200_000)
  assert.equal(calculateOrderTotal(24, '20x20').totalCop, 200_000 + 4 * 8_000)
  assert.equal(calculateOrderTotal(24, '30x30').totalCop, 280_000 + 4 * 8_000)
})
