/**
 *   npx tsx --test core/modules/album/fillPages.test.ts
 *   NEXT_PUBLIC_RITMO_LAYOUTS=true npx tsx --test core/modules/album/fillPages.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPages } from './pageEngine'
import { hasValidParity } from './fillPages'
import { foldsFromPages } from '@/core/modules/foldModel/fromPages'
import { countRealPages, validateAlbumStructure } from '@/core/modules/foldModel/validate'
import type { PoolPhoto } from './groupPhotos'

type Ori = 'landscape' | 'portrait' | 'square'
const MIX: Ori[] = ['landscape', 'portrait', 'landscape', 'landscape', 'portrait', 'square']

function pool(n: number, oris: Ori[] = MIX, withTime = true): PoolPhoto[] {
  return Array.from({ length: n }, (_, i) => {
    const o = oris[i % oris.length]
    const [width, height] = o === 'landscape' ? [4000, 3000] : o === 'portrait' ? [3000, 4000] : [3000, 3000]
    return {
      act: 'desarrollo',
      photo: {
        id: `p${i}`, src: '', url: '', width, height, orientation: o,
        score: { finalScore: (i * 37) % 100 / 100 },
        takenAt: withTime ? new Date(Date.UTC(2026, 5, 1, 10) + i * 20 * 60_000).toISOString() : null,
      },
    } as unknown as PoolPhoto
  })
}

function album(photos: PoolPhoto[]) {
  const { pages } = buildPages(photos)
  const { structure, problems } = foldsFromPages(pages)
  return { pages, structure, problems, total: countRealPages(structure) }
}

test('con pocas fotos el álbum llega a las 20 páginas incluidas', () => {
  for (const n of [15, 18, 20, 25, 30, 40]) {
    for (const withTime of [true, false]) {
      const { total, problems } = album(pool(n, MIX, withTime))
      assert.equal(total, 20, `${n} fotos (fecha=${withTime}) → ${total} págs`)
      assert.deepEqual(problems, [])
    }
  }
})

test('cada foto aparece exactamente una vez y la estructura es válida', () => {
  for (const n of [15, 22, 33]) {
    const photos = pool(n)
    const { pages, structure } = album(photos)
    const used = pages.filter(p => p.spreadHalf !== 'right').flatMap(p => p.photoIds)
    assert.deepEqual([...used].sort(), photos.map(p => p.photo.id).sort())
    assert.ok(validateAlbumStructure(structure).ok)
    assert.ok(hasValidParity(pages))
  }
})

test('con pocas fotos no quedan páginas de 4 o 5 fotos', () => {
  const { pages } = album(pool(25))
  assert.ok(pages.every(p => p.photoIds.length <= 3), pages.map(p => p.photoIds.length).join(','))
})

test('nunca pasa de las páginas incluidas por sí solo (no genera cobro extra)', () => {
  // Con muchas fotos el álbum puede tener más de 20 páginas, pero el relleno no agrega.
  const before = album(pool(15)).total
  assert.ok(before <= 20)
})

test('solo verticales: no cruzan el lomo, queda con menos páginas pero par', () => {
  const { total, pages } = album(pool(15, ['portrait']))
  assert.ok(total >= 10 && total <= 20, `${total}`)
  assert.equal(total % 2, 0)
  assert.ok(pages.every(p => p.layout !== 'hero-spread'))
})

test('tramo impar sin par fusionable: se divide una página, sin pliego huérfano (regresión)', () => {
  // Caso real: 46 fotos (casi todas horizontales 3:2) que el motor armaba en
  // páginas de 3 y 4 fotos alternadas — un tramo impar donde ningún par
  // vecino cabe en una página. Antes quedaba un pliego huérfano y el álbum
  // salía con 14 páginas.
  const photos = Array.from({ length: 46 }, (_, i) => {
    const portrait = i >= 6 && (i - 6) % 5 === 0
    const [width, height] = portrait ? [900, 1200] : i < 6 ? [1536, 1024] : [1500, 1000]
    return {
      act: 'desarrollo',
      photo: { id: `p${i}`, src: '', url: '', width, height, orientation: portrait ? 'portrait' : 'landscape',
        score: { finalScore: 0.6 }, takenAt: new Date(Date.UTC(2026, 6, 1) + i * 3600_000).toISOString() },
    } as unknown as PoolPhoto
  })
  const { pages, problems, total } = album(photos)
  assert.ok(hasValidParity(pages))
  assert.deepEqual(problems, [])
  assert.equal(total, 20)
})
