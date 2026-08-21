/**
 * Métricas geométricas puras para selección de layout por pérdida de recorte.
 * Sin efectos secundarios, sin imports de dominio — solo matemáticas de grid.
 */
import { LAYOUTS } from './layouts/registry'
import { getLayoutById } from './layouts/helpers'

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

// ── Geometría de slots (cacheada por layoutId) ────────────────────────────────

interface SlotGeom {
  ar: number    // aspect ratio width/height (página cuadrada)
  area: number  // fracción de la página [0, 1]
}

const _geomCache = new Map<string, SlotGeom[]>()

function _slotGeoms(layoutId: string): SlotGeom[] {
  const hit = _geomCache.get(layoutId)
  if (hit) return hit

  const schema = getLayoutById(layoutId)
  if (!schema) { _geomCache.set(layoutId, []); return [] }

  const colF = parseFracs(schema.grid.columns)
  const rowF = parseFracs(schema.grid.rows)
  const grid = parseAreas(schema.grid.areas)
  const tC = colF.reduce((a, b) => a + b, 0)
  const tR = rowF.reduce((a, b) => a + b, 0)

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
      ar:   (cSpan * tR) / (rSpan * tC),         // AR = (col%) / (row%) con página cuadrada
      area: (cSpan / tC) * (rSpan / tR),          // fracción de área de página
    }
  })

  _geomCache.set(layoutId, out)
  return out
}

/** AR de cada slot (width/height), página cuadrada. Cacheado. */
export function slotAspectRatios(layoutId: string): number[] {
  return _slotGeoms(layoutId).map(g => g.ar)
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
  return LAYOUTS
    .filter(l => l.photoCount === n && (l.scope ?? 'page') === 'page')
    .map(l => {
      const { avgLoss, order } = bestAssignment(photoARs, l.id)
      const adjustedLoss = l.hasAir ? avgLoss + AIR_PENALTY : avgLoss
      return { layoutId: l.id, avgLoss: adjustedLoss, order }
    })
    .sort((a, b) => a.avgLoss - b.avgLoss)
}
