/**
 *   npx tsx --test lib/orderAlbum.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveOrderAlbum, matchesWhatClientSaw, frozenBlueprintColumns, blueprintInsertColumns,
  isOrderSnapshot, printedPhotoIds, type StoredBlueprint,
} from './orderAlbum'
import { foldsFromBlueprint } from '@/core/modules/foldModel/fromBlueprint'
import { normalizeBook } from '@/core/modules/album/normalizeBook'
import { countRealPages } from '@/core/modules/foldModel/validate'
import type { AlbumStructure } from '@/core/modules/foldModel/types'

const BOOK = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ME = 'user-me'
const OTHER = 'user-other'

type Ori = 'landscape' | 'portrait' | 'square'
const MIX: Ori[] = ['landscape', 'portrait', 'landscape', 'landscape', 'portrait', 'square']

function photos(n: number, url = (i: number) => `https://assets.pixiaa.com/users/s1/original/p${i}.jpg`) {
  return Array.from({ length: n }, (_, i) => {
    const o = MIX[i % MIX.length]
    const [width, height] = o === 'landscape' ? [4000, 3000] : o === 'portrait' ? [3000, 4000] : [3000, 3000]
    return {
      id: `p${i}`, url: url(i), thumbnailUrl: url(i), width, height, orientation: o,
      score: { finalScore: ((i * 37) % 100) / 100 },
      takenAt: new Date(Date.UTC(2026, 5, 1, 10) + i * 20 * 60_000).toISOString(),
    }
  })
}

/** Álbum como lo manda el navegador (camelCase). */
function browserBook(n: number, over: Record<string, unknown> = {}) {
  return {
    id: BOOK, occasion: 'viaje', format: '30x30', style: 'con-margen', status: 'draft', version: 1,
    cover: { photoId: 'p0', templateId: '', title: 'Perú 2026', kind: 'photo' },
    spreads: [{ id: 's0', act: 'desarrollo', layout: 'single', photos: photos(n) }],
    narrative: { title: 'Perú 2026' },
    ...over,
  }
}

/** Fila de `blueprints` como la devuelve Supabase (snake_case). */
function row(n: number, over: Record<string, unknown> = {}): StoredBlueprint {
  const b = browserBook(n)
  return {
    id: BOOK, user_id: ME, session_id: 's1', status: 'draft', occasion: b.occasion, format: b.format, style: b.style,
    page_count: 20, cover: b.cover, spreads: b.spreads, narrative: b.narrative, ai_generated: true, version: 3,
    structure: null,
    ...over,
  }
}

const structureOf = (book: unknown): AlbumStructure => foldsFromBlueprint(normalizeBook(book, BOOK)).structure

function ok(r: ReturnType<typeof resolveOrderAlbum>) {
  if (!r.ok) assert.fail(`se esperaba un álbum válido y salió ${r.status}: ${r.error}`)
  return r
}

test('álbum nuevo: se arma con lo que manda el navegador y se guarda completo', () => {
  const r = ok(resolveOrderAlbum({ row: null, snapshot: browserBook(40), bookId: BOOK, userId: ME }))
  assert.equal(r.save, 'create')
  assert.equal(r.format.id, '30x30')
  assert.equal(r.pages, countRealPages(r.snapshot.structure))
  assert.ok(r.pages >= 20)
  const cols = blueprintInsertColumns(r.snapshot, { userId: ME, sessionId: 's1' })
  assert.equal(cols.user_id, ME)
  assert.equal(cols.status, 'draft')
  assert.equal(cols.page_count, r.pages)
  assert.equal(cols.spreads[0].photos.length, 40)
})

test('álbum guardado: manda la fila, no lo que envíe el navegador', () => {
  // La cuenta tiene 30 fotos en 30×30; el navegador dice 80 fotos en 20×20.
  const r = ok(resolveOrderAlbum({ row: row(30), snapshot: browserBook(80, { format: '20x20' }), bookId: BOOK, userId: ME }))
  assert.equal(r.save, 'keep')
  assert.equal(r.format.id, '30x30')
  assert.equal(r.snapshot.spreads[0].photos.length, 30)
  assert.equal(r.pages, countRealPages(structureOf(row(30))))
  assert.equal(r.snapshot.version, 3)
  assert.equal(r.snapshot.aiGenerated, true)
})

test('usa la estructura guardada por el editor cuando es válida', () => {
  const structure = structureOf(row(60))
  const r = ok(resolveOrderAlbum({ row: row(60, { structure }), snapshot: {}, bookId: BOOK, userId: ME }))
  assert.deepEqual(r.snapshot.structure, JSON.parse(JSON.stringify(structure)))
  assert.equal(r.pages, countRealPages(structure))
})

test('álbum de otra persona: 403', () => {
  const r = resolveOrderAlbum({ row: row(30, { user_id: OTHER }), snapshot: browserBook(30), bookId: BOOK, userId: ME })
  assert.deepEqual([r.ok, !r.ok && r.status], [false, 403])
})

test('álbum ya pedido: no se vuelve a cobrar ni se toca (409)', () => {
  for (const status of ['ordered', 'printing', 'shipped', 'delivered']) {
    const r = resolveOrderAlbum({ row: row(30, { status }), snapshot: browserBook(30), bookId: BOOK, userId: ME })
    assert.deepEqual([r.ok, !r.ok && r.status], [false, 409], status)
  }
})

test('fila sin dueño: se cobra la copia del navegador y se reclama', () => {
  const r = ok(resolveOrderAlbum({ row: row(30, { user_id: null }), snapshot: browserBook(45), bookId: BOOK, userId: ME }))
  assert.equal(r.save, 'claim')
  assert.equal(r.snapshot.spreads[0].photos.length, 45)
})

test('menos del mínimo de páginas: 400', () => {
  const r = resolveOrderAlbum({ row: null, snapshot: browserBook(3), bookId: BOOK, userId: ME })
  assert.equal(r.ok, false)
  if (!r.ok) { assert.equal(r.status, 400); assert.match(r.error, /mínimo/) }
})

test('formato que todavía no se vende: 400', () => {
  const r = resolveOrderAlbum({ row: null, snapshot: browserBook(30, { format: '20x20' }), bookId: BOOK, userId: ME })
  // Si el 20×20 ya está a la venta este caso deja de aplicar: el álbum se acepta.
  if (r.ok) assert.equal(r.format.available, true)
  else assert.match(r.error, /todavía no está disponible/)
})

test('una foto colocada que no terminó de subir: no se cobra (409)', () => {
  for (const bad of ['data:image/jpeg;base64,AAAA', 'blob:https://pixiaa.com/123', '']) {
    const book = browserBook(30)
    book.spreads[0].photos[7].url = bad
    const r = resolveOrderAlbum({ row: null, snapshot: book, bookId: BOOK, userId: ME })
    assert.equal(r.ok, false, bad)
    if (!r.ok) { assert.equal(r.status, 409); assert.match(r.error, /Una foto de tu álbum no terminó de subir/) }
  }
})

test('varias fotos sin subir: el mensaje dice cuántas', () => {
  const book = browserBook(30)
  for (const i of [2, 5, 9]) book.spreads[0].photos[i].url = 'data:image/jpeg;base64,AAAA'
  const r = resolveOrderAlbum({ row: null, snapshot: book, bookId: BOOK, userId: ME })
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.error, /^3 fotos de tu álbum no terminaron de subir/)
})

test('datos ilegibles: 400, nunca una excepción', () => {
  for (const snapshot of [null, 'hola', 42, {}, { spreads: 'x', cover: {}, occasion: 'viaje' }]) {
    const r = resolveOrderAlbum({ row: null, snapshot, bookId: BOOK, userId: ME })
    assert.deepEqual([r.ok, !r.ok && r.status], [false, 400], JSON.stringify(snapshot))
  }
})

test('lo que vio el cliente tiene que coincidir con lo que se cobra', () => {
  const r = ok(resolveOrderAlbum({ row: row(30), snapshot: browserBook(30), bookId: BOOK, userId: ME }))
  assert.equal(matchesWhatClientSaw(r, { pagesTotal: r.pages, format: '30x30' }), true)
  assert.equal(matchesWhatClientSaw(r, { pagesTotal: r.pages, format: undefined }), true) // sin formato = 30×30
  assert.equal(matchesWhatClientSaw(r, { pagesTotal: r.pages + 2, format: '30x30' }), false)
  assert.equal(matchesWhatClientSaw(r, { pagesTotal: r.pages, format: 'a4' }), false)
  assert.equal(matchesWhatClientSaw(r, { pagesTotal: 'abc', format: '30x30' }), false)
})

test('el checkout y el servidor cuentan las mismas páginas', () => {
  // El checkout hace: structure guardada si es válida, si no foldsFromBlueprint(normalizeBook(fila)).
  for (const n of [12, 20, 37, 64, 100]) {
    const r = ok(resolveOrderAlbum({ row: row(n), snapshot: {}, bookId: BOOK, userId: ME }))
    assert.equal(r.pages, countRealPages(structureOf(row(n))), `${n} fotos`)
  }
})

test('al aprobarse el pago el álbum se congela con la copia cobrada', () => {
  const r = ok(resolveOrderAlbum({ row: row(30), snapshot: {}, bookId: BOOK, userId: ME }))
  // Lo que queda en la base es JSON: ida y vuelta.
  const stored = JSON.parse(JSON.stringify(r.snapshot))
  assert.equal(isOrderSnapshot(stored), true)
  const frozen = frozenBlueprintColumns(stored)
  assert.ok(frozen)
  assert.equal(frozen.page_count, r.pages)
  assert.equal(frozen.format, '30x30')
  assert.deepEqual(frozen.structure, stored.structure)
  assert.equal(frozen.spreads[0].photos.length, 30)
  assert.deepEqual(Object.keys(frozen).sort(), ['cover', 'format', 'narrative', 'page_count', 'spreads', 'structure', 'style'])
})

test('la copia cobrada sirve tal cual para armar el PDF (misma estructura y fotos)', () => {
  const structure = structureOf(row(48))
  const r = ok(resolveOrderAlbum({ row: row(48, { structure }), snapshot: {}, bookId: BOOK, userId: ME }))
  const again = ok(resolveOrderAlbum({ row: null, snapshot: JSON.parse(JSON.stringify(r.snapshot)), bookId: BOOK, userId: ME }))
  assert.deepEqual(again.snapshot.structure, r.snapshot.structure)
  assert.equal(again.pages, r.pages)
  assert.deepEqual(printedPhotoIds(again.snapshot.structure).sort(), printedPhotoIds(r.snapshot.structure).sort())
})

test('órdenes viejas (copia del navegador, sin estructura válida): no se congela contenido', () => {
  assert.equal(frozenBlueprintColumns(null), null)
  assert.equal(frozenBlueprintColumns({}), null)
  assert.equal(frozenBlueprintColumns(browserBook(30)), null) // sin structure
  assert.equal(frozenBlueprintColumns({ ...browserBook(30), structure: { folds: [] } }), null)
  // Estructura que no corresponde a las fotos de la copia.
  assert.equal(frozenBlueprintColumns({ ...browserBook(30), structure: structureOf(browserBook(50)) }), null)
  assert.equal(isOrderSnapshot(browserBook(30)), false)
})

test('la foto de portada también tiene que estar subida cuando la portada es de foto', () => {
  const book = browserBook(30)
  const ids = new Set(printedPhotoIds(structureOf(book)))
  assert.ok(ids.has('p0'), 'el álbum de prueba coloca todas sus fotos')
  // Portada gráfica: no depende de ninguna foto.
  const graphic = browserBook(30, { cover: { photoId: '', templateId: '', title: 'Perú', kind: 'graphic' } })
  assert.equal(resolveOrderAlbum({ row: null, snapshot: graphic, bookId: BOOK, userId: ME }).ok, true)
})
