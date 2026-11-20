/**
 *   npx tsx --test core/modules/print/pageMargin.test.ts
 *
 * Márgenes de página: el visor, el editor y el PDF dibujan el mismo marco.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { marginContentAspect, faceHasPageMargin, FacePageView, PAGE_MARGIN_RATIO } from '@/core/modules/viewer/SpreadFaces'
import { PrintFace } from './PrintFacePage'
import { getBookPrintProfile } from './printProfiles'
import { buildPrintJobInput } from './buildPrintJobInput'
import type { Face } from '@/core/modules/foldModel/types'

const BOOK = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const face = { id: 'f1', kind: 'photos', layout: 'single', photoIds: ['p0'], isEmpty: false } as unknown as Face
const photos = new Map([['p0', { id: 'p0', url: 'https://assets.pixiaa.com/a.jpg', thumbnailUrl: '', width: 4000, height: 3000, orientation: 'landscape' }]]) as never

test('el área dentro del margen: cuadrada sigue cuadrada, la vertical queda un poco más angosta', () => {
  assert.equal(marginContentAspect(1), 1)
  // 21×28: (0,9 × 0,75) / (1 − 0,1 × 0,75)
  assert.ok(Math.abs(marginContentAspect(0.75) - 0.675 / 0.925) < 1e-9)
})

test('qué caras llevan margen', () => {
  assert.equal(faceHasPageMargin(face, 'con-margen'), true)
  assert.equal(faceHasPageMargin(face, 'sin-margen'), false)
  assert.equal(faceHasPageMargin(face, undefined), false)
  const dedication = { ...face, kind: 'dedication', dedication: {} } as unknown as Face
  assert.equal(faceHasPageMargin(dedication, 'con-margen'), true) // como en el visor de siempre
})

test('pantalla: margen del 5 % del ancho; sin margen, nada', () => {
  assert.match(renderToStaticMarkup(h(FacePageView, { face, photosById: photos, style: 'con-margen' })), /padding:5%/)
  assert.doesNotMatch(renderToStaticMarkup(h(FacePageView, { face, photosById: photos, style: 'sin-margen' })), /padding:5%/)
})

test('PDF: el margen se mide sobre la página terminada y se le suma el sangrado', () => {
  for (const format of ['30x30', '20x20', 'a4']) {
    const profile = getBookPrintProfile(format)
    const html = renderToStaticMarkup(h(PrintFace, { face, photosById: photos, profile, style: 'con-margen' }))
    const expected = (profile.bleedMm + PAGE_MARGIN_RATIO * profile.widthMm).toFixed(3)
    assert.ok(html.includes(`padding:${expected}mm`), `${format}: se esperaba padding ${expected}mm`)
    const bleed = renderToStaticMarkup(h(PrintFace, { face, photosById: photos, profile, style: 'sin-margen' }))
    assert.doesNotMatch(bleed, /padding:[\d.]+mm/, `${format}: a sangre no lleva margen`)
  }
})

test('el trabajo de impresión lleva el estilo del álbum (sin estilo guardado: con margen, como lo mostraba el visor)', () => {
  const book = (style?: string) => ({
    id: BOOK, occasion: 'viaje', format: '30x30', status: 'ordered', version: 1, ...(style ? { style } : {}),
    cover: { photoId: 'p0', templateId: '', title: 'Prueba', kind: 'photo' }, narrative: { title: 'Prueba' },
    spreads: [{ id: 's0', act: 'desarrollo', layout: 'single', photos: Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`, url: `https://assets.pixiaa.com/p${i}.jpg`, thumbnailUrl: '', width: 4000, height: 3000, orientation: 'landscape',
      score: { finalScore: 0.5 }, takenAt: new Date(Date.UTC(2026, 5, 1) + i * 60_000).toISOString(),
    })) }],
  })
  const style = (b: unknown) => { const r = buildPrintJobInput(b, BOOK); assert.ok(r.ok); return r.ok ? r.input.style : null }
  assert.equal(style(book('sin-margen')), 'sin-margen')
  assert.equal(style(book('con-margen')), 'con-margen')
  assert.equal(style(book()), 'con-margen')
})
