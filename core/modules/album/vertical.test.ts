/**
 *   npx tsx --test core/modules/album/vertical.test.ts
 *   NEXT_PUBLIC_RITMO_LAYOUTS=true npx tsx --test core/modules/album/vertical.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPages } from './pageEngine'
import { withPageAspect, aspectOfFormat } from './pageGeometry'
import { slotAspectRatios, pageLayoutsFor, layoutFitsPage } from './layoutFit'
import { getLayoutById } from './layouts/helpers'
import { foldsFromPages } from '@/core/modules/foldModel/fromPages'
import { countRealPages } from '@/core/modules/foldModel/validate'
import type { PoolPhoto } from './groupPhotos'

const V = aspectOfFormat('a4') // 0.75

function pool(n: number, landscapeShare = 0.8): PoolPhoto[] {
  return Array.from({ length: n }, (_, i) => {
    const land = (i * 7919) % 100 < landscapeShare * 100
    const [width, height] = land ? [4032, 3024] : [3024, 4032]
    return {
      act: 'desarrollo',
      photo: { id: `p${i}`, src: '', url: '', width, height, orientation: land ? 'landscape' : 'portrait',
        score: { finalScore: ((i * 37) % 100) / 100 }, takenAt: new Date(Date.UTC(2026, 6, 1) + i * 40 * 60_000).toISOString() },
    } as unknown as PoolPhoto
  })
}

test('proporción del formato', () => {
  assert.equal(aspectOfFormat('30x30'), 1)
  assert.equal(aspectOfFormat('20x20'), 1)
  assert.equal(V, 0.75)
})

test('en vertical los slots cambian de proporción (stack-2 = dos horizontales 3:2)', () => {
  assert.deepEqual(slotAspectRatios('stack-2', 1), [2, 2])
  assert.deepEqual(slotAspectRatios('stack-2', V), [1.5, 1.5])
})

test('los dípticos-tira no se usan en vertical; los verticales no se usan en cuadrado', () => {
  assert.equal(layoutFitsPage(getLayoutById('side-2')!, 1), true)
  assert.equal(layoutFitsPage(getLayoutById('side-2')!, V), false)
  assert.equal(layoutFitsPage(getLayoutById('v-travel-5')!, 1), false)
  assert.equal(layoutFitsPage(getLayoutById('v-travel-5')!, V), true)
  for (const n of [1, 2, 3, 4, 5]) assert.ok(pageLayoutsFor(n, V).length >= 2, `vertical sin layouts de ${n}`)
})

test('álbum de viaje vertical: muchas fotos, varias por página, todo dentro de lo permitido', () => {
  for (const n of [30, 60, 90]) {
    const { pages } = withPageAspect(V, () => buildPages(pool(n)))
    const { structure, problems } = foldsFromPages(pages)
    assert.deepEqual(problems, [])
    for (const p of pages) assert.ok(layoutFitsPage(getLayoutById(p.layout)!, V), `${p.layout} no sirve en vertical`)
    const used = pages.filter(p => p.spreadHalf !== 'right').flatMap(p => p.photoIds)
    assert.equal(used.length, n)
    const total = countRealPages(structure)
    assert.ok(total >= 20, `${n} fotos → ${total} págs`)
    if (n >= 60) assert.ok(pages.some(p => p.photoIds.length >= 3), 'con muchas fotos debe haber páginas de varias fotos')
  }
})

test('el cuadrado no cambia por el vertical (mismas páginas que sin withPageAspect)', () => {
  const a = buildPages(pool(40)).pages.map(p => p.layout).join(',')
  const b = withPageAspect(1, () => buildPages(pool(40))).pages.map(p => p.layout).join(',')
  assert.equal(a, b)
  assert.ok(!a.includes('v-'), 'un layout vertical se coló en cuadrado')
})
