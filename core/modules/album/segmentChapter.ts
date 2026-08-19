/**
 * Segmentación de capítulo por programación dinámica con ritmo.
 *
 * Decisión conjunta: dónde cortar la secuencia + qué layout por grupo,
 * minimizando pérdida geométrica + penalizaciones de repetición.
 * Sin efectos secundarios; el orden cronológico de las fotos no se altera.
 */
import type { PoolPhoto } from './groupPhotos'
import { rankLayoutsForPhotos } from './layoutFit'
import { LAYOUTS } from './layouts/registry'
import type { LayoutId } from './layouts/registry'

// ── Pesos de penalización de ritmo (calibrables — van al taste dataset) ──────

/** Penaliza elegir el mismo layout que el grupo anterior. */
export const W_SAME_LAYOUT = 0.20

/** Penaliza que la densidad del grupo coincida con la del grupo anterior. */
export const W_SAME_DENSITY = 0.10

/**
 * Penaliza dos layouts con aire consecutivos.
 * Es el mecanismo central de contraste: sin esta penalización, una secuencia
 * de fotos portrait elegiría aire en cada grupo y eliminaría el full-bleed
 * que da ritmo visual al álbum.
 */
export const W_CONSECUTIVE_AIR = 0.15

// ─────────────────────────────────────────────────────────────────────────────

export interface SegmentedGroup {
  photos: PoolPhoto[]
  layout: LayoutId
  isChapterOpener: boolean
  avgLoss: number   // pérdida ajustada del layout elegido (para telemetría)
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function scoreOf(p: PoolPhoto): number {
  return p.photo.score?.finalScore ?? 0
}

function photoAR(p: PoolPhoto): number {
  const ph = p.photo
  const w = ph.width ?? 0
  const h = ph.height ?? 0
  if (w > 0 && h > 0) return w / h
  const ori = ph.orientation ?? 'landscape'
  return ori === 'portrait' ? 0.72 : ori === 'square' ? 1.0 : 1.4
}

type Density = 'solo' | 'light' | 'mid' | 'dense'

function densityOf(k: number): Density {
  if (k === 1) return 'solo'
  if (k === 2) return 'light'
  if (k === 3) return 'mid'
  return 'dense'
}

function layoutHasAir(layoutId: string): boolean {
  return LAYOUTS.find(l => l.id === layoutId)?.hasAir === true
}

// ── DP interno ────────────────────────────────────────────────────────────────

/**
 * Segmenta `photos` en grupos de 1–5 minimizando la suma de:
 *   - Pérdida de crop ajustada del layout elegido (ya incluye AIR_PENALTY)
 *   - Penalizaciones de ritmo (same-layout, same-density, aire-consecutivo)
 *
 * initLayout/initDensity/initAir representan el grupo inmediatamente anterior
 * al inicio del array (p. ej. el opener del capítulo).
 */
function dpSegment(
  photos: PoolPhoto[],
  initLayout: string,
  initDensity: string,
  initAir: boolean,
): SegmentedGroup[] {
  const n = photos.length
  if (n === 0) return []

  type Choice = { k: number; layout: string; loss: number }
  const memo = new Map<string, number>()
  const back = new Map<string, Choice>()

  function dp(i: number, prevLayout: string, prevDensity: string, prevAir: boolean): number {
    if (i >= n) return 0
    const key = `${i}|${prevLayout}|${prevDensity}|${prevAir}`
    const hit = memo.get(key)
    if (hit !== undefined) return hit

    let bestTotal = Infinity
    let bestChoice: Choice = { k: 1, layout: 'single', loss: 1 }

    const maxK = Math.min(5, n - i)
    for (let k = 1; k <= maxK; k++) {
      const ars = photos.slice(i, i + k).map(photoAR)
      const ranked = rankLayoutsForPhotos(ars)
      if (ranked.length === 0) continue

      const { layoutId, avgLoss } = ranked[0]
      const air = layoutHasAir(layoutId)
      const density = densityOf(k)

      // avgLoss ya incluye AIR_PENALTY de rankLayoutsForPhotos — no duplicar
      let cost = avgLoss
      if (prevLayout && layoutId === prevLayout) cost += W_SAME_LAYOUT
      if (prevDensity && density === prevDensity) cost += W_SAME_DENSITY
      if (prevAir && air) cost += W_CONSECUTIVE_AIR

      const future = dp(i + k, layoutId, density, air)
      const total = cost + future

      if (total < bestTotal) {
        bestTotal = total
        bestChoice = { k, layout: layoutId, loss: avgLoss }
      }
    }

    memo.set(key, bestTotal)
    back.set(key, bestChoice)
    return bestTotal
  }

  dp(0, initLayout, initDensity, initAir)

  // ── Reconstruir la solución ────────────────────────────────────────────────
  const result: SegmentedGroup[] = []
  let i = 0
  let prevLayout = initLayout
  let prevDensity = initDensity
  let prevAir = initAir

  while (i < n) {
    const key = `${i}|${prevLayout}|${prevDensity}|${prevAir}`
    const choice = back.get(key)
    if (!choice) {
      // Fallback de seguridad: emitir el resto como un único bloque
      result.push({ photos: photos.slice(i), layout: 'single' as LayoutId, isChapterOpener: false, avgLoss: 1 })
      break
    }
    const { k, layout, loss } = choice
    result.push({
      photos: photos.slice(i, i + k),
      layout: layout as LayoutId,
      isChapterOpener: false,
      avgLoss: loss,
    })
    prevAir = layoutHasAir(layout)
    prevLayout = layout
    prevDensity = densityOf(k)
    i += k
  }

  return result
}

// ── Función pública ───────────────────────────────────────────────────────────

/**
 * Segmenta un capítulo de fotos en grupos con su layout ya elegido.
 *
 * @param photos         Fotos del capítulo en orden cronológico.
 * @param isChapterOpener  True para el primer capítulo (activa extracción de opener).
 */
export function segmentChapter(
  photos: PoolPhoto[],
  isChapterOpener: boolean,
): SegmentedGroup[] {
  if (photos.length === 0) return []

  // Opener explícito: solo si el capítulo tiene ≥4 fotos.
  // Con capítulos pequeños el opener solitario destruye el ritmo.
  if (isChapterOpener && photos.length >= 4) {
    const openerIdx = photos.reduce(
      (best, p, i) => (scoreOf(p) > scoreOf(photos[best]) ? i : best),
      0,
    )
    const opener = photos[openerIdx]
    const rest = photos.filter((_, i) => i !== openerIdx)

    const ori = opener.photo.orientation ?? 'landscape'
    const ar = photoAR(opener)
    let openerLayout: LayoutId

    if (ori === 'landscape' || ar > 1.0) {
      openerLayout = 'hero-spread'
    } else {
      const ranked = rankLayoutsForPhotos([ar])
      openerLayout = (ranked[0]?.layoutId ?? 'single') as LayoutId
    }

    const openerGroup: SegmentedGroup = {
      photos: [opener],
      layout: openerLayout,
      isChapterOpener: true,
      avgLoss: 0,
    }

    const restGroups = dpSegment(
      rest,
      openerLayout,
      densityOf(1),
      layoutHasAir(openerLayout),
    )

    return [openerGroup, ...restGroups]
  }

  // Capítulo pequeño o sin tratamiento especial: DP desde estado neutro
  return dpSegment(photos, '', '', false)
}
