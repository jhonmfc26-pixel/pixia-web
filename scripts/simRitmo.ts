/**
 * Simulador del motor de layouts — mide el RITMO de álbumes sintéticos.
 *
 * Corre el pipeline real (buildPages: capítulos → segmentChapter → paridad)
 * sobre álbumes generados con distribuciones de aspect ratio realistas de
 * celular, y reporta por escenario:
 *   - mezcla de tiers por página (full-bleed / equilibrado / aire)
 *   - racha máxima de páginas seguidas en el mismo tier y cuántas violan el tope
 *   - pérdida de recorte promedio y % de fotos con recorte fuerte (>30%)
 *   - páginas totales (impacta costo de impresión) y variedad de layouts
 *
 * El catálogo se decide en build/carga (NEXT_PUBLIC_RITMO_LAYOUTS), así que
 * para comparar se corre dos veces:
 *   NEXT_PUBLIC_RITMO_LAYOUTS=false npx tsx scripts/simRitmo.ts
 *   NEXT_PUBLIC_RITMO_LAYOUTS=true  npx tsx scripts/simRitmo.ts
 * o ambos de una con:  npx tsx scripts/simRitmo.ts --compare
 *
 * Determinista (RNG con semilla): el mismo commit da los mismos números.
 */
import { execFileSync } from 'node:child_process'

const TARGET = { 'full-bleed': 0.45, equilibrado: 0.35, aire: 0.20 } as const
const MAX_RUN = 2
const BAD_CROP = 0.30

type Tier = 'full-bleed' | 'equilibrado' | 'aire'

interface Scenario {
  name: string
  photos: number
  /** [aspect ratio, peso] — distribución de la que se muestrea cada foto. */
  ars: Array<[number, number]>
  /** Cantidad de "momentos" (capítulos esperados). */
  moments: number
}

// AR típicos de celular: 4:3 / 3:4 dominantes, algo de 16:9, 9:16, 1:1, 3:2.
const SCENARIOS: Scenario[] = [
  { name: 'viaje (mayoría horizontal)', photos: 80, moments: 6,
    ars: [[4 / 3, 45], [16 / 9, 12], [3 / 2, 8], [3 / 4, 25], [9 / 16, 5], [1, 5]] },
  { name: 'boda (mayoría vertical)', photos: 90, moments: 4,
    ars: [[3 / 4, 45], [9 / 16, 10], [2 / 3, 10], [4 / 3, 25], [16 / 9, 5], [1, 5]] },
  { name: 'mixto 50/50', photos: 60, moments: 5,
    ars: [[4 / 3, 35], [3 / 4, 35], [16 / 9, 8], [9 / 16, 8], [1, 14]] },
  { name: 'álbum corto', photos: 30, moments: 3,
    ars: [[4 / 3, 40], [3 / 4, 40], [16 / 9, 10], [1, 10]] },
  { name: 'álbum grande', photos: 150, moments: 10,
    ars: [[4 / 3, 40], [3 / 4, 30], [16 / 9, 10], [9 / 16, 8], [3 / 2, 6], [1, 6]] },
]
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

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

function pick<T>(r: () => number, items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let x = r() * total
  for (const [v, w] of items) { x -= w; if (x <= 0) return v }
  return items[items.length - 1][0]
}

async function runMode() {
  // Solo calibración: RHYTHM_OVERRIDES='{"W_PAGE":0.1,"TIER_BIAS":{...}}' pisa los pesos del motor.
  if (process.env.RHYTHM_OVERRIDES) {
    const { RHYTHM } = await import('../core/modules/album/rhythmEngine')
    Object.assign(RHYTHM, JSON.parse(process.env.RHYTHM_OVERRIDES))
  }
  const { buildPages } = await import('../core/modules/album/pageEngine')
  const { getLayoutById } = await import('../core/modules/album/layouts/helpers')
  const { bestAssignment } = await import('../core/modules/album/layoutFit')
  const { classifyOrientation } = await import('../core/modules/album/photoGeometry')
  type PoolPhoto = import('../core/modules/album/groupPhotos').PoolPhoto

  const tierOf = (layoutId: string): Tier => {
    const s = getLayoutById(layoutId)
    if (s?.tier) return s.tier
    return s?.hasAir ? 'aire' : 'full-bleed'
  }

  function makeAlbum(sc: Scenario, seed: number): PoolPhoto[] {
    const r = rng(seed * 1000 + sc.photos)
    const out: PoolPhoto[] = []
    const start = Date.UTC(2026, 0, 1, 8)
    for (let i = 0; i < sc.photos; i++) {
      const moment = Math.floor((i / sc.photos) * sc.moments)
      // momentos separados por ~1 día; fotos dentro del momento cada ~5 min
      const takenAt = new Date(start + moment * 86_400_000 + i * 300_000).toISOString()
      const ar = pick(r, sc.ars)
      const height = 3000
      const width = Math.round(height * ar)
      // score: la mayoría mediocre, algunas excelentes (sesgo realista)
      const finalScore = Math.round(100 * Math.pow(r(), 1.8))
      out.push({
        act: 'act1' as never,
        photo: {
          id: `p${i}`, r2Key: '', url: '', thumbnailUrl: '', originalName: '',
          width, height, orientation: classifyOrientation(ar), takenAt,
          score: { sharpness: 0, exposure: 0, composition: 0, faces: 0, resolution: 0, uniqueness: 0, emotionalWeight: 0,
            finalScore, recommendation: 'supporting' },
        } as PoolPhoto['photo'],
      })
    }
    return out
  }

  const results: Record<string, Record<string, number>> = {}
  for (const sc of SCENARIOS) {
    const acc = { pages: 0, fb: 0, eq: 0, air: 0, maxRun: 0, runViolations: 0, loss: 0, badCrops: 0, photos: 0,
      distinct: 0, sameLayoutRepeats: 0, heroBleed: 0, heroPages: 0, dupes: 0 }
    for (const seed of SEEDS) {
      const album = makeAlbum(sc, seed)
      const byId = new Map(album.map(p => [p.photo.id, p]))
      const { pages } = buildPages(album)
      const seen = new Set<string>()
      const tiers: Tier[] = []
      const layouts: string[] = []
      for (const page of pages) {
        tiers.push(tierOf(page.layout))
        layouts.push(page.layout)
        if (page.spreadHalf === 'right') continue
        for (const id of page.photoIds) { if (seen.has(id)) acc.dupes++; seen.add(id) }
        const ars = page.photoIds.map(id => { const p = byId.get(id)!.photo; return p.width / p.height })
        const schema = getLayoutById(page.layout)
        if (schema?.scope === 'spread') continue
        const { avgLoss } = bestAssignment(ars, page.layout)
        acc.loss += avgLoss * ars.length
        acc.photos += ars.length
        // recorte fuerte: aproximado por la pérdida media del layout
        if (avgLoss > BAD_CROP) acc.badCrops += ars.length
      }
      // fotos "hero" (top 10% por score) — ¿cayeron en una página de 1 foto full-bleed?
      const sorted = [...album].sort((a, b) => b.photo.score.finalScore - a.photo.score.finalScore)
      const heroIds = new Set(sorted.slice(0, Math.max(1, Math.round(album.length * 0.1))).map(p => p.photo.id))
      for (const page of pages) {
        if (page.spreadHalf === 'right') continue
        if (page.photoIds.length === 1 && heroIds.has(page.photoIds[0])) acc.heroPages++
        if (page.photoIds.length === 1 && heroIds.has(page.photoIds[0]) && tierOf(page.layout) === 'full-bleed') acc.heroBleed++
      }
      if (seen.size !== album.length) acc.dupes += album.length - seen.size // fotos perdidas también cuentan
      let run = 0
      for (let i = 0; i < tiers.length; i++) {
        run = i > 0 && tiers[i] === tiers[i - 1] ? run + 1 : 1
        acc.maxRun = Math.max(acc.maxRun, run)
        if (run > MAX_RUN) acc.runViolations++
        if (i > 0 && layouts[i] === layouts[i - 1] && pages[i].spreadHalf !== 'right') acc.sameLayoutRepeats++
      }
      acc.pages += pages.length
      acc.fb += tiers.filter(t => t === 'full-bleed').length
      acc.eq += tiers.filter(t => t === 'equilibrado').length
      acc.air += tiers.filter(t => t === 'aire').length
      acc.distinct += new Set(layouts).size
    }
    const n = SEEDS.length
    results[sc.name] = {
      paginas: acc.pages / n,
      fullBleed: acc.fb / acc.pages,
      equilibrado: acc.eq / acc.pages,
      aire: acc.air / acc.pages,
      rachaMax: acc.maxRun,
      paginasSobreTope: acc.runViolations / acc.pages,
      perdidaRecorte: acc.loss / acc.photos,
      recorteFuerte: acc.badCrops / acc.photos,
      layoutsDistintos: acc.distinct / n,
      mismoLayoutSeguido: acc.sameLayoutRepeats / acc.pages,
      heroEnFullBleed: acc.heroPages ? acc.heroBleed / acc.heroPages : 0,
      fotosRepetidasOPerdidas: acc.dupes,
    }
  }
  return results
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`

function printTable(label: string, res: Record<string, Record<string, number>>, other?: Record<string, Record<string, number>>) {
  console.log(`\n═══ ${label} ═══  (objetivo: ${pct(TARGET['full-bleed'])} FB / ${pct(TARGET.equilibrado)} EQ / ${pct(TARGET.aire)} aire, racha ≤ ${MAX_RUN})`)
  for (const [name, m] of Object.entries(res)) {
    const o = other?.[name]
    const d = (k: string, f: (x: number) => string) => (o ? `${f(m[k])} (antes ${f(o[k])})` : f(m[k]))
    console.log(`\n  ${name}`)
    console.log(`    páginas            ${d('paginas', x => x.toFixed(1))}`)
    console.log(`    mezcla FB/EQ/aire  ${pct(m.fullBleed)} / ${pct(m.equilibrado)} / ${pct(m.aire)}${o ? `   (antes ${pct(o.fullBleed)} / ${pct(o.equilibrado)} / ${pct(o.aire)})` : ''}`)
    console.log(`    racha máx          ${d('rachaMax', x => String(x))}   páginas sobre el tope: ${d('paginasSobreTope', pct)}`)
    console.log(`    pérdida recorte    ${d('perdidaRecorte', pct)}   recorte fuerte >${pct(BAD_CROP)}: ${d('recorteFuerte', pct)}`)
    console.log(`    layouts distintos  ${d('layoutsDistintos', x => x.toFixed(1))}   mismo layout seguido: ${d('mismoLayoutSeguido', pct)}`)
    console.log(`    hero → full-bleed  ${d('heroEnFullBleed', pct)}`)
    console.log(`    fotos repetidas/perdidas: ${m.fotosRepetidasOPerdidas}`)
  }
}

async function main() {
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(await runMode()))
    return
  }
  if (process.argv.includes('--compare')) {
    const run = (flag: string) => JSON.parse(execFileSync('npx', ['tsx', __filename, '--json'], {
      env: { ...process.env, NEXT_PUBLIC_RITMO_LAYOUTS: flag, NODE_ENV: 'production' },
      encoding: 'utf8', maxBuffer: 1 << 26,
    }))
    const before = run('false')
    const after = run('true')
    printTable('Motor actual (flag OFF)', before)
    printTable('Ritmo Pixia (flag ON) vs actual', after, before)
    return
  }
  const flag = process.env.NEXT_PUBLIC_RITMO_LAYOUTS === 'true'
  printTable(flag ? 'Ritmo Pixia (flag ON)' : 'Motor actual (flag OFF)', await runMode())
}

main().catch(err => { console.error(err); process.exit(1) })
