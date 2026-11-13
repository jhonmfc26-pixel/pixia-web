/**
 *   npx tsx --test lib/coverDesigns.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countryInTitle, sortDesigns, designToCover, imageSize, type CoverDesign } from './coverDesigns'

const d = (id: string, occasion: string, country: string | null, sort = 0): CoverDesign => ({
  id, created_at: '', name: id, occasion, country, art_url: `https://x/${id}.png`, art_width: 3000, art_height: 4000,
  layout: 'poster', bg: '#F06292', fg: '#FFFFFF', accent: null, font_id: 'bebas', text_position: 'top', text_align: 'left', active: true, sort,
})

test('encuentra el país en el título, sin tildes ni mayúsculas', () => {
  assert.equal(countryInTitle('Nuestro viaje a PERU 2025', ['Perú', 'México']), 'Perú')
  assert.equal(countryInTitle('Luna de miel en México', ['Perú', 'México']), 'México')
  assert.equal(countryInTitle('Vacaciones', ['Perú']), undefined)
  assert.equal(countryInTitle('Superu', ['Perú']), undefined, 'solo palabras completas')
})

test('orden: ocasión y país primero', () => {
  const list = [d('boda1', 'boda', null), d('mex', 'viaje', 'México'), d('peru', 'viaje', 'Perú'), d('viaje', 'viaje', null)]
  assert.deepEqual(sortDesigns(list, 'viaje', 'Peru').map(x => x.id), ['peru', 'mex', 'viaje', 'boda1'])
})

test('al elegir un diseño se copia todo lo necesario para dibujarlo', () => {
  const c = designToCover(d('peru', 'viaje', 'Perú'))
  assert.equal(c.kind, 'graphic')
  assert.equal(c.artUrl, 'https://x/peru.png')
  assert.equal(c.artAspect, 0.75)
  assert.equal(c.textAlign, 'left')
})

test('lee el tamaño de un PNG por su cabecera', () => {
  const png = new Uint8Array(32)
  png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  new DataView(png.buffer).setUint32(16, 3200)
  new DataView(png.buffer).setUint32(20, 4000)
  assert.deepEqual(imageSize(png.buffer), { width: 3200, height: 4000 })
})
