/**
 * Tests del motor de ritmo (Fase B2). Corren con el catálogo Ritmo Pixia:
 *   NEXT_PUBLIC_RITMO_LAYOUTS=true npx tsx --test core/modules/album/rhythmEngine.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { segmentWithRhythm, tierOf, nextState, rhythmCost, RHYTHM, NEUTRAL_STATE, type RhythmState } from './rhythmEngine'
import { buildPages } from './pageEngine'
import { getLayoutById } from './layouts/helpers'
import { RITMO_LAYOUTS_ENABLED } from './layouts/ritmoFlag'
import type { PoolPhoto } from './groupPhotos'

assert.ok(RITMO_LAYOUTS_ENABLED, 'El motor de ritmo está apagado (NEXT_PUBLIC_RITMO_LAYOUTS=false)')

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ARS = [4 / 3, 3 / 4, 16 / 9, 9 / 16, 1, 3 / 2]

function album(n: number, seed: number, ars = ARS, chapters = 4): PoolPhoto[] {
  const r = rng(seed)
  return Array.from({ length: n }, (_, i) => {
    const ar = ars[Math.floor(r() * ars.length)]
    return {
      act: 'act1' as never,
      photo: {
        id: `p${i}`, width: Math.round(3000 * ar), height: 3000,
        orientation: ar > 1.15 ? 'landscape' : ar < 0.87 ? 'portrait' : 'square',
        takenAt: new Date(Date.UTC(2026, 0, 1) + Math.floor((i / n) * chapters) * 86_400_000 + i * 300_000).toISOString(),
        score: { finalScore: Math.round(100 * r()) },
      } as PoolPhoto['photo'],
    }
  })
}

/** Tiers por página física (un spread cuenta 2). */
function pageTiers(layouts: string[]): string[] {
  return layouts.flatMap(l => (getLayoutById(l)?.scope === 'spread' ? [tierOf(l), tierOf(l)] : [tierOf(l)]))
}

function maxRun(tiers: string[]): number {
  let best = 0, run = 0
  tiers.forEach((t, i) => { run = i > 0 && t === tiers[i - 1] ? run + 1 : 1; best = Math.max(best, run) })
  return best
}

test('cada foto exactamente una vez y en orden', () => {
  for (const seed of [1, 2, 3]) {
    const photos = album(40, seed).slice(0, 40)
    const groups = segmentWithRhythm(photos)
    const ids = groups.flatMap(g => g.photos.map(p => p.photo.id))
    assert.deepEqual(ids, photos.map(p => p.photo.id))
    for (const g of groups) {
      assert.ok(g.photos.length >= 1 && g.photos.length <= 5)
      assert.equal(getLayoutById(g.layout)?.photoCount, g.photos.length, `layout ${g.layout} con ${g.photos.length} fotos`)
    }
  }
})

test('álbum completo: nunca más de MAX_RUN páginas seguidas en el mismo tier', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    for (const ars of [ARS, [4 / 3, 16 / 9], [3 / 4, 9 / 16]]) { // mixto, solo horizontales, solo verticales
      const { pages } = buildPages(album(70, seed, ars))
      const tiers = pages.map(p => tierOf(p.layout)) // buildPages ya emite las 2 mitades del spread
      assert.ok(maxRun(tiers) <= RHYTHM.MAX_RUN, `seed ${seed}: racha ${maxRun(tiers)}`)
    }
  }
})

test('álbum completo: sin fotos repetidas ni perdidas', () => {
  for (const seed of [7, 8, 9]) {
    const photos = album(90, seed)
    const { pages } = buildPages(photos)
    const ids = pages.filter(p => p.spreadHalf !== 'right').flatMap(p => p.photoIds)
    assert.equal(new Set(ids).size, ids.length, 'fotos repetidas')
    assert.equal(ids.length, photos.length, 'fotos perdidas')
  }
})

test('mustEndEven deja el tramo con páginas pares', () => {
  for (let n = 2; n <= 12; n++) {
    const groups = segmentWithRhythm(album(n, n), NEUTRAL_STATE, { mustEndEven: true })
    const pages = pageTiers(groups.map(g => g.layout)).length
    assert.equal(pages % 2, 0, `${n} fotos → ${pages} páginas`)
  }
})

test('el borde con el capítulo siguiente respeta el tope', () => {
  // El siguiente capítulo abre con hero-spread (full-bleed, 2 páginas): la
  // última página de este tramo no puede ser full-bleed.
  for (const seed of [1, 2, 3, 4]) {
    const groups = segmentWithRhythm(album(15, seed), NEUTRAL_STATE, { nextLayout: 'hero-spread', mustEndEven: true })
    const tiers = [...pageTiers(groups.map(g => g.layout)), 'full-bleed', 'full-bleed']
    assert.ok(maxRun(tiers) <= RHYTHM.MAX_RUN, `seed ${seed}: ${tiers.join(',')}`)
  }
})

test('rhythmCost: tercer página igual cuesta mucho más que la segunda', () => {
  const fb = 'single'
  assert.equal(tierOf(fb), 'full-bleed')
  const one: RhythmState = nextState(NEUTRAL_STATE, fb)
  const two = nextState(one, 'stack-2')
  assert.ok(rhythmCost(two, 'grid-3') - rhythmCost(one, 'grid-3') >= RHYTHM.W_RUN_OVER - RHYTHM.W_SAME_TIER - 1e-9)
})

test('determinista', () => {
  const a = buildPages(album(60, 42)).pages.map(p => p.layout)
  const b = buildPages(album(60, 42)).pages.map(p => p.layout)
  assert.deepEqual(a, b)
})
