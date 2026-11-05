/**
 * Segmentación de capítulo por programación dinámica con ritmo.
 *
 * Decisión conjunta: dónde cortar la secuencia + qué layout por grupo,
 * minimizando pérdida geométrica + penalizaciones de repetición.
 * Sin efectos secundarios; el orden cronológico de las fotos no se altera.
 */
import type { PoolPhoto } from './groupPhotos'
import { rankLayoutsForPhotos } from './layoutFit'
import { photoAR } from './photoGeometry'
import { LAYOUTS } from './layouts/registry'
import type { LayoutId } from './layouts/registry'
import { RITMO_LAYOUTS_ENABLED } from './layouts/ritmoFlag'
import { segmentWithRhythm, nextState, NEUTRAL_STATE, type RhythmState, type RhythmEnd } from './rhythmEngine'

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
  /**
   * Solo Ritmo Pixia (flag ON): estado de ritmo al final del capítulo
   * anterior, para que el tope de páginas seguidas en el mismo tier no se
   * rompa en el cambio de capítulo. Con el flag OFF se ignora.
   */
  prevRhythm: RhythmState = NEUTRAL_STATE,
  /** Solo Ritmo Pixia: qué viene después de este capítulo (ver RhythmEnd). */
  end: RhythmEnd = { mustEndEven: false },
): SegmentedGroup[] {
  if (photos.length === 0) return []

  const opener = chooseOpener(photos, isChapterOpener)
  if (opener) {
    const { index: openerIdx, layout: openerLayout } = opener
    const rest = photos.filter((_, i) => i !== openerIdx)

    const openerGroup: SegmentedGroup = {
      photos: [photos[openerIdx]],
      layout: openerLayout,
      isChapterOpener: true,
      avgLoss: 0,
    }

    const restGroups = RITMO_LAYOUTS_ENABLED
      ? segmentWithRhythm(rest, nextState(prevRhythm, openerLayout), end).map(asSegmented)
      : dpSegment(
        rest,
        openerLayout,
        densityOf(1),
        layoutHasAir(openerLayout),
      )

    return [openerGroup, ...restGroups]
  }

  // Capítulo pequeño o sin tratamiento especial: DP desde estado neutro
  if (RITMO_LAYOUTS_ENABLED) return segmentWithRhythm(photos, prevRhythm, end).map(asSegmented)
  return dpSegment(photos, '', '', false)
}

/**
 * Opener del capítulo: la foto de mayor score, sola. Landscape → hero-spread
 * (doble página); vertical → el mejor layout de 1 foto. Solo con ≥4 fotos:
 * en capítulos chicos un opener solitario destruye el ritmo. Exportado para
 * que groupPhotos sepa de antemano cómo ARRANCA el capítulo siguiente.
 */
export function chooseOpener(
  photos: PoolPhoto[],
  isChapterOpener: boolean,
): { index: number; layout: LayoutId } | null {
  if (!isChapterOpener || photos.length < 4) return null
  const index = photos.reduce((best, p, i) => (scoreOf(p) > scoreOf(photos[best]) ? i : best), 0)
  const opener = photos[index]
  const ori = opener.photo.orientation ?? 'landscape'
  const ar = photoAR(opener)
  if (ori === 'landscape' || ar > 1.0) return { index, layout: 'hero-spread' as LayoutId }
  const ranked = rankLayoutsForPhotos([ar])
  return { index, layout: (ranked[0]?.layoutId ?? 'single') as LayoutId }
}

function asSegmented(g: { photos: PoolPhoto[]; layout: LayoutId; avgLoss: number }): SegmentedGroup {
  return { photos: g.photos, layout: g.layout, isChapterOpener: false, avgLoss: g.avgLoss }
}
