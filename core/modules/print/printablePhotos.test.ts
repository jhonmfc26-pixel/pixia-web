/**
 *   npx tsx --test core/modules/print/printablePhotos.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findUnprintablePhotos, describeUnprintable, placedPhotoIds, isPrintableUrl } from './printablePhotos'
import { buildPrintJobInput } from './buildPrintJobInput'

const url = (i: number) => `https://assets.pixiaa.com/users/s1/original/p${i}.jpg`
function album(n: number, over: Record<string, unknown> = {}) {
  return {
    id: 'a1', occasion: 'viaje', format: '30x30', style: 'con-margen',
    cover: { photoId: 'p0', templateId: '', title: 'Perú', kind: 'photo' },
    spreads: [{ id: 's0', act: 'desarrollo', layout: 'single', photos: Array.from({ length: n }, (_, i) => ({
      id: `p${i}`, url: url(i), width: 4000, height: 3000, orientation: 'landscape', score: { finalScore: 0.5 },
      takenAt: new Date(Date.UTC(2026, 5, 1, 10) + i * 1_200_000).toISOString(),
    })) }],
    ...over,
  }
}
function input(raw: unknown) {
  const built = buildPrintJobInput(raw, 'a1')
  if (!built.ok) assert.fail(built.reason)
  return built.input
}

test('un álbum con todas sus fotos subidas se puede imprimir', () => {
  const i = input(album(30))
  assert.equal(placedPhotoIds(i.structure).length, 30)
  assert.deepEqual(findUnprintablePhotos(i), [])
})

test('una foto que quedó como copia dentro del álbum, local del navegador o vacía no se imprime', () => {
  for (const bad of ['data:image/jpeg;base64,AAAA', 'blob:https://pixiaa.com/1', '', 'http://assets.pixiaa.com/x.jpg']) {
    const raw = album(30)
    raw.spreads[0].photos[9].url = bad
    assert.deepEqual(findUnprintablePhotos(input(raw)), [{ photoId: 'p9', where: 'interior', reason: 'no terminó de subir' }], bad)
  }
})

test('la foto de portada cuenta solo cuando la portada es de foto', () => {
  const raw = album(30)
  raw.spreads[0].photos[0].url = 'data:image/jpeg;base64,AAAA'
  const withPhotoCover = findUnprintablePhotos(input(raw))
  assert.deepEqual(withPhotoCover.map(p => p.where).sort(), ['interior', 'portada'])

  // Portada gráfica: la misma foto mala solo falla donde está colocada (interior).
  const graphic = album(30, { cover: { photoId: '', templateId: '', title: 'Perú', kind: 'graphic' } })
  graphic.spreads[0].photos[0].url = 'data:image/jpeg;base64,AAAA'
  assert.deepEqual(findUnprintablePhotos(input(graphic)).map(p => p.where), ['interior'])
})

test('una foto colocada que ya no existe en el álbum', () => {
  const i = input(album(30))
  delete i.photos.p4
  assert.deepEqual(findUnprintablePhotos(i), [{ photoId: 'p4', where: 'interior', reason: 'no está en el álbum' }])
})

test('el mensaje para el equipo dice cuántas y qué hacer', () => {
  const raw = album(30)
  for (const k of [1, 2, 3, 4, 5, 6, 7]) raw.spreads[0].photos[k].url = ''
  const msg = describeUnprintable(findUnprintablePhotos(input(raw)))
  assert.match(msg, /^7 fotos del álbum no se pueden imprimir/)
  assert.match(msg, /y 2 más/)
  assert.match(msg, /vuelva a subir/)
  assert.match(describeUnprintable([{ photoId: 'x', where: 'portada', reason: 'no terminó de subir' }]), /^Una foto del álbum no se puede imprimir: x \(portada/)
})

test('solo https cuenta como subida', () => {
  assert.equal(isPrintableUrl(url(1)), true)
  for (const bad of [undefined, null, 42, '', ' ', 'https://', 'https://a b', 'ftp://x/y.jpg']) assert.equal(isPrintableUrl(bad), false, String(bad))
})
