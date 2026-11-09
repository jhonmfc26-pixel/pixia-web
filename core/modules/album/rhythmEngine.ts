/**
 * Fase B2 — motor de RITMO "Ritmo Pixia".
 *
 * Reemplaza (solo con NEXT_PUBLIC_RITMO_LAYOUTS=true) al DP de
 * segmentChapter.ts. Misma decisión conjunta — dónde cortar la secuencia de
 * fotos y qué layout va en cada página — pero pensando a nivel de SECUENCIA,
 * no página por página:
 *
 *   1. Varios candidatos por grupo. El DP viejo solo consideraba el layout
 *      geométricamente mejor para cada grupo; el ritmo solo podía cambiar
 *      cuántas fotos iban por página. Acá entran todos los layouts cuyo
 *      recorte está cerca del mejor (MAX_EXTRA_LOSS) y es aceptable en
 *      absoluto (MAX_ABS_LOSS) — así hay alternativas reales de tier.
 *   2. El ritmo se mide por TIER de densidad (full-bleed / equilibrado /
 *      aire), no por cantidad de fotos. Tope duro de MAX_RUN páginas seguidas
 *      en el mismo tier.
 *   3. Mezcla objetivo del álbum (TARGET_MIX) vía un sesgo de costo por tier
 *      (TIER_BIAS), calibrado con scripts/simRitmo.ts.
 *   4. El full-bleed de una sola foto se reserva para las fotos destacadas
 *      del capítulo (W_HERO).
 *
 * Invariantes que NO cambian: orden cronológico intacto, cada foto exactamente
 * una vez, 1–5 fotos por página (el 6 queda para cuando se suba MAX_COUNT).
 */
import type { PoolPhoto } from './groupPhotos'
import type { DensityTier } from './layouts/types'
import type { LayoutId } from './layouts/registry'
import { LAYOUTS } from './layouts/registry'
import { bestAssignment, pageLayoutsFor } from './layoutFit'
import { photoAR } from './photoGeometry'

// ── Parámetros (calibrados con scripts/simRitmo.ts — ver PR de Fase B2) ─────

export const RHYTHM = {
  /** Mezcla que se busca en un álbum típico (aprobada por Jhon, nov 2026). */
  TARGET_MIX: { 'full-bleed': 0.45, equilibrado: 0.35, aire: 0.20 } as Record<DensityTier, number>,
  /** Máximo de páginas seguidas en el mismo tier. */
  MAX_RUN: 2,
  /** Costo de pasarse del tope — alto para que sea duro salvo que no exista alternativa. */
  W_RUN_OVER: 1.0,
  /** Costo suave de repetir tier (2ª página seguida igual) — empuja a alternar. */
  W_SAME_TIER: 0.04,
  /** Costo de repetir exactamente el mismo layout que la página anterior. */
  W_SAME_LAYOUT: 0.20,
  /**
   * Sesgo por tier, sumado al costo de recorte. Negativo = el motor lo
   * prefiere. Es la perilla que acerca la mezcla real a TARGET_MIX.
   */
  TIER_BIAS: { 'full-bleed': 0.03, equilibrado: -0.16, aire: 0.06 } as Record<DensityTier, number>,
  /** Un layout entra como candidato si su recorte ≤ mejor + esto... */
  MAX_EXTRA_LOSS: 0.15,
  /** ...y su recorte absoluto ≤ esto (nunca sacrificar la foto por el ritmo). */
  MAX_ABS_LOSS: 0.30,
  /** Bono/castigo de full-bleed de 1 foto según qué tan destacada es la foto. */
  W_HERO: 0.10,
  /** Costo por página — mantiene el número de páginas (= costo de impresión) a raya. */
  W_PAGE: 0.20,
  /**
   * Costo de dejar un tramo entre spreads con páginas impares. foldsFromPages
   * necesita tramos pares; si el DP no los deja pares, normalizePageParity
   * fusiona/parte páginas a ciegas (sin mirar tiers) y rompe el ritmo.
   */
  W_PARITY: 3.0,
}

const MAX_GROUP = 5

// ── Helpers ─────────────────────────────────────────────────────────────────

export function tierOf(layoutId: string): DensityTier {
  const schema = LAYOUTS.find(l => l.id === layoutId)
  if (schema?.tier) return schema.tier
  // Layouts base (pre-Ritmo) no declaran tier: con aire → 'aire', si no full-bleed.
  return schema?.hasAir ? 'aire' : 'full-bleed'
}

function pagesOf(layoutId: string): number {
  return LAYOUTS.find(l => l.id === layoutId)?.scope === 'spread' ? 2 : 1
}

/**
 * "Qué tan destacada" es cada foto dentro de su capítulo, 0–1, por rango de
 * score (no por valor absoluto: los scores varían mucho entre álbumes). Con
 * scores empatados (p.ej. todos en el default) todas quedan en 0.5 = neutro.
 */
function heroness(photos: PoolPhoto[]): number[] {
  const scores = photos.map(p => p.photo.score?.finalScore ?? 0)
  const n = scores.length
  if (n <= 1) return scores.map(() => 0.5)
  return scores.map(s => {
    let below = 0, equal = 0
    for (const o of scores) { if (o < s) below++; else if (o === s) equal++ }
    return (below + (equal - 1) / 2) / (n - 1)
  })
}

export interface RhythmState {
  layout: string
  tier: DensityTier | ''
  /** Páginas seguidas en `tier` al final de la secuencia previa. */
  run: number
  /** Páginas desde el último spread, módulo 2 (0 = tramo par). */
  parity: 0 | 1
}

export const NEUTRAL_STATE: RhythmState = { layout: '', tier: '', run: 0, parity: 0 }

/** Estado de ritmo después de poner `layoutId` a continuación de `prev`. */
export function nextState(prev: RhythmState, layoutId: string): RhythmState {
  const tier = tierOf(layoutId)
  const pages = pagesOf(layoutId)
  return {
    layout: layoutId,
    tier,
    run: prev.tier === tier ? prev.run + pages : pages,
    parity: pages === 2 ? 0 : ((prev.parity ^ 1) as 0 | 1),
  }
}

/** Qué viene inmediatamente después de la secuencia que se está segmentando. */
export interface RhythmEnd {
  /** Layout que sigue (el opener del capítulo siguiente), para no romper el tope en el borde. */
  nextLayout?: string
  /** El tramo tiene que cerrar par: lo que sigue es un spread, o es el final del álbum. */
  mustEndEven: boolean
}

/** Costo de ritmo de poner `layoutId` después de `prev`. Puro — exportado para tests. */
export function rhythmCost(prev: RhythmState, layoutId: string): number {
  const tier = tierOf(layoutId)
  let cost = RHYTHM.TIER_BIAS[tier] + RHYTHM.W_PAGE * pagesOf(layoutId)
  if (prev.layout && prev.layout === layoutId) cost += RHYTHM.W_SAME_LAYOUT
  if (prev.tier === tier) {
    const run = nextState(prev, layoutId).run
    cost += run > RHYTHM.MAX_RUN ? RHYTHM.W_RUN_OVER * (run - RHYTHM.MAX_RUN) : RHYTHM.W_SAME_TIER
  }
  return cost
}

// ── Candidatos por grupo ────────────────────────────────────────────────────

interface Candidate { layout: string; loss: number }

function candidatesFor(ars: number[]): Candidate[] {
  const all = pageLayoutsFor(ars.length)
    .map(l => ({ layout: l.id, loss: bestAssignment(ars, l.id).avgLoss }))
  if (all.length === 0) return []
  const best = Math.min(...all.map(c => c.loss))
  const limit = Math.min(best + RHYTHM.MAX_EXTRA_LOSS, Math.max(best, RHYTHM.MAX_ABS_LOSS))
  return all.filter(c => c.loss <= limit + 1e-9)
}

// ── DP ──────────────────────────────────────────────────────────────────────

export interface RhythmGroup {
  photos: PoolPhoto[]
  layout: LayoutId
  avgLoss: number
}

/**
 * Segmenta `photos` (en orden) en páginas de 1–5 fotos con layout, minimizando
 * recorte + costo de ritmo. `init` es el estado al final de lo que va antes
 * (p.ej. el opener del capítulo o el capítulo anterior).
 */
export function segmentWithRhythm(
  photos: PoolPhoto[],
  init: RhythmState = NEUTRAL_STATE,
  end: RhythmEnd = { mustEndEven: false },
): RhythmGroup[] {
  const n = photos.length
  if (n === 0) return []

  const ars = photos.map(photoAR)
  const hero = heroness(photos)

  const candCache = new Map<string, Candidate[]>()
  const cands = (i: number, k: number) => {
    const key = `${i}:${k}`
    let c = candCache.get(key)
    if (!c) { c = candidatesFor(ars.slice(i, i + k)); candCache.set(key, c) }
    return c
  }

  type Choice = { k: number; layout: string; loss: number }
  const memo = new Map<string, number>()
  const back = new Map<string, Choice>()
  const keyOf = (i: number, s: RhythmState) => `${i}|${s.layout}|${s.tier}|${Math.min(s.run, RHYTHM.MAX_RUN + 1)}|${s.parity}`

  function terminal(prev: RhythmState): number {
    let cost = 0
    if (end.mustEndEven && prev.parity === 1) cost += RHYTHM.W_PARITY
    if (end.nextLayout) cost += rhythmCost(prev, end.nextLayout) - RHYTHM.TIER_BIAS[tierOf(end.nextLayout)] - RHYTHM.W_PAGE * pagesOf(end.nextLayout)
    return cost
  }

  function dp(i: number, prev: RhythmState): number {
    if (i >= n) return terminal(prev)
    const key = keyOf(i, prev)
    const hit = memo.get(key)
    if (hit !== undefined) return hit

    let best = Infinity
    let choice: Choice | null = null
    for (let k = 1; k <= Math.min(MAX_GROUP, n - i); k++) {
      for (const c of cands(i, k)) {
        let cost = c.loss + rhythmCost(prev, c.layout)
        if (k === 1 && tierOf(c.layout) === 'full-bleed') {
          // foto top del capítulo → bono; foto de relleno → castigo
          cost += RHYTHM.W_HERO * (1 - 2 * hero[i])
        }
        const total = cost + dp(i + k, nextState(prev, c.layout))
        if (total < best) { best = total; choice = { k, layout: c.layout, loss: c.loss } }
      }
    }
    memo.set(key, best)
    if (choice) back.set(key, choice)
    return best
  }

  dp(0, init)

  const out: RhythmGroup[] = []
  let i = 0
  let state = init
  while (i < n) {
    const choice = back.get(keyOf(i, state))
    if (!choice) {
      // Sin candidatos (no debería pasar: siempre hay layouts de 1 foto). Red de seguridad.
      out.push({ photos: photos.slice(i, i + 1), layout: 'single' as LayoutId, avgLoss: 1 })
      state = nextState(state, 'single')
      i += 1
      continue
    }
    out.push({ photos: photos.slice(i, i + choice.k), layout: choice.layout as LayoutId, avgLoss: choice.loss })
    state = nextState(state, choice.layout)
    i += choice.k
  }
  return out
}
