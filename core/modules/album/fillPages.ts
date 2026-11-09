/**
 * Relleno hacia las páginas incluidas (decisión de Jhon, 2026-11-08).
 *
 * El motor de layouts (segmentChapter / rhythmEngine) arma ~3 fotos por
 * página: con 15–30 fotos el álbum salía de 6–12 páginas aunque el precio
 * base incluye 20. Con pocas fotos Pixia les da protagonismo en vez de
 * apretarlas: después de armar las páginas, si quedan menos que el objetivo,
 * este paso las "abre", en este orden de preferencia:
 *
 *   1. Partir páginas de 4–5 fotos (nunca páginas apretadas con pocas fotos).
 *   2. Foto horizontal sola → cruza el lomo (hero-spread, doble página),
 *      evitando dos dobles páginas seguidas cuando hay alternativa.
 *   3. Partir páginas de 3 fotos, después las de 2.
 *
 * Nunca pasa del objetivo (no genera páginas extra que se cobren) y nunca
 * rompe la paridad: cada tramo de páginas normales entre composiciones queda
 * par (foldsFromPages lo exige). Por eso las operaciones se aplican de a dos
 * (+2 páginas por paso). Si ya no hay nada que abrir, el álbum queda con
 * menos páginas y el checkout lo avisa (mínimo MIN_ALBUM_PAGES).
 *
 * Puro y determinista: mismo input → mismas páginas (el visor, el checkout y
 * el PDF derivan la misma estructura).
 */
import type { Page, PageLayout } from './types'
import type { PoolPhoto } from './groupPhotos'
import { getLayoutById } from './layouts/helpers'
import { rankLayoutsForPhotos, bestAssignment } from './layoutFit'
import { photoAR } from './photoGeometry'

/** Ancho/alto desde el que una foto sola puede cruzar el lomo sin recortar de más. */
const HERO_MIN_AR = 1.25

const isSpreadPage = (p: Page) => getLayoutById(p.layout)?.scope === 'spread'

/** Todas las composiciones completas y todos los tramos de páginas normales pares. */
export function hasValidParity(pages: Page[]): boolean {
  let i = 0
  while (i < pages.length) {
    if (isSpreadPage(pages[i])) {
      if (pages[i].spreadHalf !== 'left' || pages[i + 1]?.spreadHalf !== 'right') return false
      i += 2
      continue
    }
    let run = 0
    while (i < pages.length && !isSpreadPage(pages[i])) { run++; i++ }
    if (run % 2 === 1) return false
  }
  return true
}

/** Páginas físicas (una composición cuenta 2: ya viene como 2 Page). */
export const pageTotal = (pages: Page[]) => pages.length

/** Layout de página (no spread) con mejor encaje para estas fotos, y las fotos en el orden de sus slots. */
function layoutPage(ids: string[], poolById: Map<string, PoolPhoto>, base: Page, suffix: string): Page | null {
  const photos = ids.map(id => poolById.get(id)).filter((p): p is PoolPhoto => !!p)
  if (photos.length !== ids.length) return null
  const ranked = rankLayoutsForPhotos(photos.map(photoAR))
  if (ranked.length === 0) return null
  const layout = ranked[0].layoutId as PageLayout
  const { order } = bestAssignment(photos.map(photoAR), layout)
  return {
    id: `${base.id}${suffix}`,
    layout,
    photoIds: order.map(i => photos[i].photo.id),
    act: base.act,
    isExtra: false,
  }
}

interface Op {
  /** Índice de la página que se reemplaza. */
  index: number
  replacement: Page[]
  /** Más alto = se prefiere antes. */
  priority: number
}

function scoreOf(p: PoolPhoto | undefined): number {
  return p?.photo.score?.finalScore ?? 0
}

/** Operaciones posibles sobre una página: partirla en dos, o (1 foto horizontal) volverla doble página. */
function opsFor(pages: Page[], index: number, poolById: Map<string, PoolPhoto>, chrono: Map<string, number>): Op[] {
  const page = pages[index]
  if (isSpreadPage(page) || page.photoIds.length === 0) return []
  const k = page.photoIds.length

  if (k === 1) {
    const p = poolById.get(page.photoIds[0])
    if (!p || photoAR(p) < HERO_MIN_AR) return []
    // Dos dobles páginas seguidas cansan: si ya hay una al lado, se prefiere
    // antes partir páginas de 3 fotos.
    const besideSpread = (pages[index - 1] && isSpreadPage(pages[index - 1])) || (pages[index + 1] && isSpreadPage(pages[index + 1]))
    return [{
      index,
      priority: (besideSpread ? 25 : 50) + 10 * scoreOf(p),
      replacement: [
        { id: `${page.id}-l`, layout: 'hero-spread' as PageLayout, photoIds: [p.photo.id], act: page.act, isExtra: false, spreadHalf: 'left' },
        { id: `${page.id}-r`, layout: 'hero-spread' as PageLayout, photoIds: [p.photo.id], act: page.act, isExtra: false, spreadHalf: 'right' },
      ],
    }]
  }

  // Partir respetando el orden cronológico: la mitad más equilibrada con menor recorte.
  const ids = [...page.photoIds].sort((a, b) => (chrono.get(a) ?? 0) - (chrono.get(b) ?? 0))
  let best: { pages: Page[]; cost: number } | null = null
  for (let n = 1; n < k; n++) {
    const a = layoutPage(ids.slice(0, n), poolById, page, '-a')
    const b = layoutPage(ids.slice(n), poolById, page, '-b')
    if (!a || !b) continue
    const loss = (ids: string[], l: PageLayout) =>
      bestAssignment(ids.map(id => photoAR(poolById.get(id)!)), l).avgLoss
    const cost = Math.abs(2 * n - k) + loss(a.photoIds, a.layout) + loss(b.photoIds, b.layout)
    if (!best || cost < best.cost) best = { pages: [a, b], cost }
  }
  if (!best) return []
  const priority = k >= 4 ? 100 + k : k === 3 ? 30 : 10
  return [{ index, priority, replacement: best.pages }]
}

function apply(pages: Page[], ops: Op[]): Page[] {
  const byIndex = new Map(ops.map(o => [o.index, o]))
  return pages.flatMap((p, i) => byIndex.get(i)?.replacement ?? [p])
}

/**
 * Abre el álbum hasta `target` páginas (o lo más cerca posible). `pages` debe
 * venir ya normalizado (paridad válida). `chronoOrder`: ids en orden
 * cronológico, para que al partir una página no se desordene la historia.
 */
export function fillToTargetPages(
  pages: Page[],
  poolById: Map<string, PoolPhoto>,
  chronoOrder: string[],
  target: number,
): Page[] {
  if (pageTotal(pages) >= target || !hasValidParity(pages)) return pages
  const chrono = new Map(chronoOrder.map((id, i) => [id, i]))
  let current = pages

  // Cada vuelta suma 2 páginas (dos operaciones que juntas dejan la paridad válida).
  for (let guard = 0; guard < 200 && pageTotal(current) < target; guard++) {
    const ops = current.flatMap((_, i) => opsFor(current, i, poolById, chrono))
    let best: { pages: Page[]; priority: number } | null = null
    for (let a = 0; a < ops.length; a++) {
      for (let b = a + 1; b < ops.length; b++) {
        if (ops[a].index === ops[b].index) continue
        const priority = ops[a].priority + ops[b].priority
        if (best && priority <= best.priority) continue
        const next = apply(current, [ops[a], ops[b]])
        if (pageTotal(next) > target || !hasValidParity(next)) continue
        best = { pages: next, priority }
      }
    }
    if (!best) break
    current = best.pages
  }
  return current
}
