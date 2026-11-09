/**
 * Métricas geométricas puras para selección de layout por pérdida de recorte.
 * Sin efectos secundarios, sin imports de dominio — solo matemáticas de grid.
 */
import { LAYOUTS } from './layouts/registry'
import { getLayoutById } from './layouts/helpers'
import type { LayoutSchema } from './layouts/types'
import { pageAspect, isVerticalAspect } from './pageGeometry'

// ── Parsing interno ───────────────────────────────────────────────────────────

function parseFracs(str: string): number[] {
  return str.trim().split(/\s+/).map(s => parseFloat(s))
}

function parseAreas(areas: string): string[][] {
  const rows: string[][] = []
  const rx = /"([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(areas)) !== null) {
    rows.push(m[1].trim().split(/\s+/))
  }
  return rows
}

/**
 * Fracción [0,1] de innerPadding de un layout ('15%' → 0.15). 0 si no declara.
 * Solo soporta el formato que usa el registry (porcentaje simple, mismo valor
 * en los 4 lados vía el shorthand CSS `padding: X%`) — no hay ningún layout
 * hoy con otra sintaxis.
 */
function _innerPaddingFraction(innerPadding: string | undefined): number {
  if (!innerPadding) return 0
  const m = /^([\d.]+)%$/.exec(innerPadding.trim())
  return m ? parseFloat(m[1]) / 100 : 0
}

// ── Geometría de slots (cacheada por layoutId) ────────────────────────────────

interface SlotGeom {
  ar: number    // aspect ratio width/height (página cuadrada)
  area: number  // fracción de la página [0, 1]
}

const _geomCache = new Map<string, SlotGeom[]>()

/**
 * `aspect` = ancho/alto de la página (pageGeometry.ts): 1 en 30×30 y 20×20,
 * 0.75 en el vertical 21×28. Por defecto, la de la entrada del motor que esté
 * corriendo (withPageAspect).
 */
function _slotGeoms(layoutId: string, aspect = pageAspect()): SlotGeom[] {
  const key = `${layoutId}@${aspect}`
  const hit = _geomCache.get(key)
  if (hit) return hit

  const schema = getLayoutById(layoutId)
  if (!schema) { _geomCache.set(key, []); return [] }

  const colF = parseFracs(schema.grid.columns)
  const rowF = parseFracs(schema.grid.rows)
  const grid = parseAreas(schema.grid.areas)
  const tC = colF.reduce((a, b) => a + b, 0)
  const tR = rowF.reduce((a, b) => a + b, 0)

  // innerPadding envuelve el grid ENTERO (ver SpreadFaces.tsx/LayoutRenderer.tsx:
  // `padding: schema.innerPadding` en el contenedor que rodea el <div grid>) —
  // por eso resta área por igual a TODOS los slots, no cambia sus proporciones
  // relativas entre sí. Con página cuadrada, `padding: X%` (shorthand CSS, los
  // 4 lados al mismo % — y top/bottom también resuelven contra el ANCHO del
  // contenedor, no la altura, quirk de CSS) reduce el lado visible del grid en
  // igual proporción en ambos ejes → el AR de cada slot no cambia (el recorte
  // es simétrico), pero el área que ese slot representa DEL TOTAL DE LA PÁGINA
  // sí baja, al cuadrado del factor de encogimiento lineal.
  const p = _innerPaddingFraction(schema.innerPadding)
  const areaShrink = p > 0 ? (1 - 2 * p) ** 2 : 1
  // Proporción del área del grid: la de la página, corregida por el padding
  // (el % de padding CSS se resuelve contra el ANCHO en los 4 lados, así que
  // en página no cuadrada sí cambia la proporción del grid).
  const gridAspect = aspect * (1 - 2 * p) / (1 - 2 * p * aspect)

  const out = (schema.slots as readonly string[]).map(s => {
    let cMin = Infinity, cMax = -Infinity, rMin = Infinity, rMax = -Infinity
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
        if (grid[r][c] === s) {
          if (c < cMin) cMin = c; if (c > cMax) cMax = c
          if (r < rMin) rMin = r; if (r > rMax) rMax = r
        }
      }
    }
    const cSpan = colF.slice(cMin, cMax + 1).reduce((a, b) => a + b, 0)
    const rSpan = rowF.slice(rMin, rMax + 1).reduce((a, b) => a + b, 0)
    return {
      ar:   (cSpan * tR) / (rSpan * tC) * gridAspect,       // AR = (col%) / (row%) × proporción del grid
      area: (cSpan / tC) * (rSpan / tR) * areaShrink,        // fracción de área de página, ya neta del innerPadding
    }
  })

  _geomCache.set(key, out)
  return out
}

/** AR de cada slot (width/height) en una página de proporción `aspect`. Cacheado. */
export function slotAspectRatios(layoutId: string, aspect?: number): number[] {
  return _slotGeoms(layoutId, aspect).map(g => g.ar)
}

// ── Qué layouts sirven para la página ─────────────────────────────────────────

/** Slots más angostos o más panorámicos que esto se ven como tiras: no se usan. */
const MIN_SLOT_AR = 0.42
const MAX_SLOT_AR = 2.8

/**
 * Si un layout sirve en una página de proporción `aspect`. En cuadrado pasan
 * todos menos los exclusivos del vertical; en vertical se caen los que dejan
 * tiras (p. ej. dos verticales lado a lado: 10,5×28 cm = 0.38).
 */
export function layoutFitsPage(schema: LayoutSchema, aspect = pageAspect()): boolean {
  if (schema.onlyVertical && !isVerticalAspect(aspect)) return false
  if ((schema.scope ?? 'page') === 'spread') return true
  return slotAspectRatios(schema.id, aspect).every(ar => ar >= MIN_SLOT_AR && ar <= MAX_SLOT_AR)
}

/** Layouts de página para N fotos que sirven en la página actual. */
export function pageLayoutsFor(photoCount: number, aspect = pageAspect()): LayoutSchema[] {
  return LAYOUTS.filter(l => l.photoCount === photoCount && (l.scope ?? 'page') === 'page' && layoutFitsPage(l, aspect))
}

/** Fracción del área de la página que ocupa cada slot [0, 1]. Cacheado. */
export function slotAreas(layoutId: string): number[] {
  return _slotGeoms(layoutId).map(g => g.area)
}

// ── Slot dominante ("hero") por geometría ──────────────────────────────────────

const HERO_MIN_RATIO = 1.4

/**
 * Índice del slot dominante de un layout, calculado por área real (nunca
 * hardcodeado por nombre) — así layouts futuros heredan el comportamiento
 * correcto automáticamente.
 *
 * Reglas:
 * - Si un único slot tiene el área máxima Y esa área es > HERO_MIN_RATIO
 *   veces el promedio de las demás → devuelve su índice (posición dentro de
 *   photoIds/schema.slots, no necesariamente 0 — ej. hero-3-top tiene el
 *   slot grande al final).
 * - Si varios slots empatan en el área máxima (layout simétrico) o no hay
 *   slots para comparar (1 solo slot) → devuelve null: no hay "destacar"
 *   con efecto visible en ese layout.
 */
export function getHeroSlotIndex(layoutId: string): number | null {
  const areas = slotAreas(layoutId)
  if (areas.length < 2) return null

  const maxArea = Math.max(...areas)
  const EPS = 1e-9
  const maxIndices: number[] = []
  areas.forEach((a, i) => { if (Math.abs(a - maxArea) < EPS) maxIndices.push(i) })

  if (maxIndices.length !== 1) return null

  const heroIndex = maxIndices[0]
  const others = areas.filter((_, i) => i !== heroIndex)
  const avgOthers = others.reduce((a, b) => a + b, 0) / others.length
  if (avgOthers <= 0) return null

  return maxArea > HERO_MIN_RATIO * avgOthers ? heroIndex : null
}

// ── Pérdida de recorte ────────────────────────────────────────────────────────

/**
 * Pérdida de cover-crop al encajar una foto en un slot.
 * 0 = sin recorte (ARs idénticos), 1 = foto completamente recortada.
 * Fórmula: 1 − min(AR_foto, AR_slot) / max(AR_foto, AR_slot)
 */
export function cropLoss(photoAR: number, slotAR: number): number {
  if (photoAR <= 0 || slotAR <= 0) return 1
  return 1 - Math.min(photoAR, slotAR) / Math.max(photoAR, slotAR)
}

// ── Asignación óptima foto→slot ───────────────────────────────────────────────

function _perms(arr: number[]): number[][] {
  if (arr.length <= 1) return [[...arr]]
  const out: number[][] = []
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.filter((_, j) => j !== i)
    for (const p of _perms(rest)) out.push([arr[i], ...p])
  }
  return out
}

/**
 * Encuentra la asignación foto→slot de menor pérdida media.
 * N ≤ 5 → máx 120 permutaciones, trivial en tiempo.
 *
 * order[slotIndex] = índice de foto del array de entrada que va en ese slot.
 */
export function bestAssignment(
  photoARs: number[],
  layoutId: string,
): { avgLoss: number; order: number[] } {
  const slotARs = slotAspectRatios(layoutId)
  const n = photoARs.length
  const identity = Array.from({ length: n }, (_, i) => i)
  if (n === 0 || slotARs.length === 0) return { avgLoss: 0, order: identity }

  let bestLoss = Infinity
  let bestOrder = identity

  for (const perm of _perms(identity)) {
    let loss = 0
    for (let s = 0; s < n; s++) loss += cropLoss(photoARs[perm[s]], slotARs[s])
    if (loss < bestLoss) { bestLoss = loss; bestOrder = perm }
  }

  return { avgLoss: bestLoss / n, order: bestOrder }
}

// ── Ranking de layouts ────────────────────────────────────────────────────────

// Penalización para layouts con aire (hasAir: true).
// El full-bleed es el estilo de la casa; el aire solo gana cuando ahorra
// más de 12 puntos de pérdida respecto al mejor layout full-bleed.
// Aumentar si el álbum queda todo enmarcado; bajar si hay demasiado recorte.
const AIR_PENALTY = 0.12

/**
 * Evalúa todos los layouts de scope 'page' con photoCount === N y los ordena
 * por pérdida ajustada ascendente.
 *
 * Los layouts con `hasAir: true` reciben AIR_PENALTY adicional para que el
 * full-bleed siga siendo la opción por defecto y el aire solo aparezca cuando
 * recortar destruiría la foto (ahorro real > AIR_PENALTY).
 *
 * Las celdas vacías '.' en grid-template-areas no necesitan tratamiento
 * especial aquí: _slotGeoms itera schema.slots (que no incluye '.'),
 * por lo que las celdas vacías se ignoran automáticamente.
 */
export function rankLayoutsForPhotos(
  photoARs: number[],
): Array<{ layoutId: string; avgLoss: number; order: number[] }> {
  const n = photoARs.length
  return pageLayoutsFor(n)
    .map(l => {
      const { avgLoss, order } = bestAssignment(photoARs, l.id)
      const adjustedLoss = l.hasAir ? avgLoss + AIR_PENALTY : avgLoss
      return { layoutId: l.id, avgLoss: adjustedLoss, order }
    })
    .sort((a, b) => a.avgLoss - b.avgLoss)
}
