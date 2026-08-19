import type { Page, PageLayout, LayoutConfig, AlbumPages } from './types'
import { getLayoutById, getLayoutsByPhotoCount } from './layouts/helpers'
import { groupPhotos, type PhotoGroup, type PoolPhoto } from './groupPhotos'
import { rankLayoutsForPhotos, bestAssignment, slotAspectRatios, slotAreas, cropLoss } from './layoutFit'

function scoreOf(item: PoolPhoto): number {
  return item.photo.score?.finalScore ?? 0
}

/** AR real de una foto. Fallback a constantes por orientación si faltan dimensiones. */
function photoAR(photo: PoolPhoto): number {
  const p = photo.photo
  if (p.width > 0 && p.height > 0) return p.width / p.height
  const ori = p.orientation ?? 'landscape'
  return ori === 'portrait' ? 0.72 : ori === 'square' ? 1.0 : 1.4
}

/**
 * Ordena fotos para los slots del layout elegido.
 *
 * Base: asignación geométrica óptima (menor pérdida de cover-crop total).
 * Override para slot dominante: si el slot 0 ocupa ≥2× el área media del resto,
 * se pone en él la foto de mayor score entre las que encajan bien (pérdida < 0.25).
 * Si ninguna encaja bien en el slot dominante, la geometría manda.
 */
function orderPhotosForLayout(
  photos: PoolPhoto[],
  layout: PageLayout,
  ars: number[],
): PoolPhoto[] {
  const { order } = bestAssignment(ars, layout)
  // order[slotIdx] = índice de foto → geometricOrder[slotIdx] = la foto para ese slot
  const geometricOrder = order.map(i => photos[i])

  const areas = slotAreas(layout)
  const n = areas.length
  if (n < 2) return geometricOrder

  const avgOthers = areas.slice(1).reduce((a, b) => a + b, 0) / (n - 1)
  if (areas[0] < avgOthers * 2) return geometricOrder   // sin slot dominante

  // Slot 0 dominante: candidatos con buena geometría (pérdida < 0.25)
  const slot0AR = slotAspectRatios(layout)[0]
  const LOSS_THR = 0.25
  const candidates = photos
    .map((p, i) => ({ i, score: scoreOf(p), loss: cropLoss(ars[i], slot0AR) }))
    .filter(c => c.loss < LOSS_THR)

  if (candidates.length === 0) return geometricOrder

  const best = candidates.reduce((a, c) => c.score > a.score ? c : a)
  if (photos[best.i].photo.id === geometricOrder[0].photo.id) return geometricOrder

  // Poner la foto de mayor score en slot 0; resto en orden geométrico
  const result: PoolPhoto[] = new Array(n)
  result[0] = photos[best.i]
  const chosenId = result[0].photo.id
  let slot = 1
  for (const p of geometricOrder) {
    if (p.photo.id !== chosenId) result[slot++] = p
  }
  return result
}

/**
 * @deprecated Llamado solo como fallback cuando un grupo llega sin layout pre-decidido.
 * En el flujo normal todos los grupos vienen de segmentChapter con layout ya asignado.
 */
function selectGroupLayout(group: PhotoGroup): PageLayout {
  const [first] = group.photos
  const count = group.photos.length

  if (group.isChapterOpener && (first.photo.orientation ?? 'landscape') === 'landscape') {
    return 'hero-spread'
  }

  const ars = group.photos.map(photoAR)
  const ranked = rankLayoutsForPhotos(ars)
  if (ranked.length === 0) {
    console.warn(`[LayoutFit] sin layouts para ${count} fotos — fallback 'single'`)
    return 'single' as PageLayout
  }
  const { layoutId: chosen, avgLoss } = ranked[0]
  console.log(`[LayoutFit] fallback: grupo de ${count} → ${chosen} (${(avgLoss * 100).toFixed(0)}%)`)
  return chosen as PageLayout
}

function canUseLayoutForGroup(layout: PageLayout, group: PhotoGroup): boolean {
  const schema = getLayoutById(layout)
  if (!schema) return false
  return schema.photoCount === group.photos.length
}

// ── Normalización de paridad (estrategia C) ───────────────────────────────────
// Garantiza que cada tramo de páginas normales entre composiciones sea par,
// de modo que foldsFromPages empareje todo sin caras huérfanas.

function selectMergeLayout(
  count: number, photoIds: string[], poolById: Map<string, PoolPhoto>,
): PageLayout {
  const valid = getLayoutsByPhotoCount(count).filter(l => l.scope !== 'spread')
  if (valid.length === 0) {
    console.error(`[PageEngine] Paridad: sin layout para ${count} fotos, fallback single`)
    return 'single'
  }
  if (count === 2) {
    const oriA = poolById.get(photoIds[0])?.photo.orientation ?? 'landscape'
    const oriB = poolById.get(photoIds[1])?.photo.orientation ?? 'landscape'
    return oriA === 'portrait' && oriB === 'portrait' ? 'side-2' : 'stack-2'
  }
  if (count === 3) {
    const oris = photoIds.map(id => poolById.get(id)?.photo.orientation ?? 'landscape')
    if (oris.every(o => o === 'landscape')) return 'trio-row'
    if (oris.every(o => o === 'portrait')) return 'trio-column'
    return 'grid-3'
  }
  return valid[0].id as PageLayout
}

function splitPageForParity(page: Page, poolById: Map<string, PoolPhoto>): Page[] {
  const total = page.photoIds.length
  if (total < 2) {
    console.warn('[PageEngine] Paridad: página de 1 foto en tramo solitario — pliego huérfano inevitable')
    return [page]
  }

  // Buscar la división más equilibrada en dos mitades con layouts válidos
  type Split = [number, number]
  const candidates: Split[] = []
  for (let n = 1; n < total; n++) {
    const m = total - n
    const hasLeft  = getLayoutsByPhotoCount(n).some(l => l.scope !== 'spread')
    const hasRight = getLayoutsByPhotoCount(m).some(l => l.scope !== 'spread')
    if (hasLeft && hasRight) candidates.push([n, m])
  }

  if (candidates.length === 0) {
    console.warn('[PageEngine] Paridad: sin división válida para página de', total, 'fotos — pliego huérfano inevitable')
    return [page]
  }

  // La división más equilibrada (mínima diferencia entre mitades)
  const [leftCount, rightCount] = candidates.reduce((best, curr) =>
    Math.abs(curr[0] - curr[1]) < Math.abs(best[0] - best[1]) ? curr : best
  )

  const leftIds  = page.photoIds.slice(0, leftCount)
  const rightIds = page.photoIds.slice(leftCount)

  console.log(`[PageEngine] Paridad: dividiendo ${page.id} (${total} fotos) → ${leftCount}+${rightCount}`)
  return [
    { id: `${page.id}-a`, layout: selectMergeLayout(leftCount,  leftIds,  poolById), photoIds: leftIds,  act: page.act, isExtra: false },
    { id: `${page.id}-b`, layout: selectMergeLayout(rightCount, rightIds, poolById), photoIds: rightIds, act: page.act, isExtra: false },
  ]
}

function mergeOnceParity(tract: Page[], poolById: Map<string, PoolPhoto>): Page[] {
  if (tract.length === 0) return tract

  // Tramo de 1 página: no hay par para fusionar — intentar dividirla en 2
  if (tract.length === 1) return splitPageForParity(tract[0], poolById)

  const MAX_COUNT = 5
  let bestIdx = -1
  let bestCount = Infinity

  for (let j = 0; j < tract.length - 1; j++) {
    const combined = tract[j].photoIds.length + tract[j + 1].photoIds.length
    if (combined > MAX_COUNT) continue
    if (getLayoutsByPhotoCount(combined).filter(l => l.scope !== 'spread').length === 0) continue
    if (combined < bestCount) { bestCount = combined; bestIdx = j }
  }

  if (bestIdx === -1) {
    console.warn('[PageEngine] Paridad: ningún par fusionable en el tramo — pliego huérfano inevitable')
    return tract
  }

  const left  = tract[bestIdx]
  const right = tract[bestIdx + 1]
  const combinedIds = [...left.photoIds, ...right.photoIds]
  const merged: Page = {
    id: left.id,
    layout: selectMergeLayout(combinedIds.length, combinedIds, poolById),
    photoIds: combinedIds,
    act: left.act,
    isExtra: false,
  }

  const result = [...tract]
  result.splice(bestIdx, 2, merged)
  return result
}

// Paso 2 de paridad: absorbe páginas de 1 foto que quedaron en tramos solitarios
// (huérfanos que splitPageForParity no pudo resolver), cruzando la composición.
function absorbOrphansAcrossSpreads(pages: Page[], poolById: Map<string, PoolPhoto>): Page[] {
  type Seg = { isSpread: boolean; pages: Page[] }

  function parseSegs(ps: Page[]): Seg[] {
    const out: Seg[] = []
    let j = 0
    while (j < ps.length) {
      const isSprd = getLayoutById(ps[j].layout)?.scope === 'spread'
      if (isSprd) {
        const sp: Page[] = [ps[j]]
        if (j + 1 < ps.length && ps[j + 1].spreadHalf === 'right') {
          sp.push(ps[j + 1]); j += 2
        } else {
          j += 1
        }
        out.push({ isSpread: true, pages: sp })
      } else {
        const start = j
        while (j < ps.length && getLayoutById(ps[j].layout)?.scope !== 'spread') j++
        out.push({ isSpread: false, pages: ps.slice(start, j) })
      }
    }
    return out
  }

  const segs = parseSegs(pages)

  let changed = true
  while (changed) {
    changed = false
    for (let s = 0; s < segs.length; s++) {
      const seg = segs[s]
      if (seg.isSpread || seg.pages.length !== 1 || seg.pages[0].photoIds.length !== 1) continue

      // Tramo solitario con 1 página de 1 foto — buscar vecino normal adyacente
      let neighborIdx = -1
      for (let n = s + 1; n < segs.length; n++) {
        if (!segs[n].isSpread && segs[n].pages.length > 0) { neighborIdx = n; break }
      }
      if (neighborIdx === -1) {
        for (let n = s - 1; n >= 0; n--) {
          if (!segs[n].isSpread && segs[n].pages.length > 0) { neighborIdx = n; break }
        }
      }

      if (neighborIdx === -1) {
        console.warn('[PageEngine] Paridad: foto huérfana sin tramo vecino — pliego irreducible [DEV]')
        continue
      }

      const orphan = seg.pages[0]
      const neighbor = segs[neighborIdx]
      const neighborIsAfter = neighborIdx > s
      const boundaryIdx = neighborIsAfter ? 0 : neighbor.pages.length - 1
      const boundaryPage = neighbor.pages[boundaryIdx]
      const combinedCount = 1 + boundaryPage.photoIds.length
      const neighborIsOdd = neighbor.pages.length % 2 === 1
      // Fusionar solo si el vecino es par (para no empeorar su paridad) y cabe en un layout
      const canFuse = !neighborIsOdd && combinedCount <= 5 &&
        getLayoutsByPhotoCount(combinedCount).some(l => l.scope !== 'spread')

      const newNeighborPages = [...neighbor.pages]

      if (canFuse) {
        // FUSIONAR: absorber la foto huérfana en la página límite del vecino par
        const combinedIds = neighborIsAfter
          ? [orphan.photoIds[0], ...boundaryPage.photoIds]
          : [...boundaryPage.photoIds, orphan.photoIds[0]]
        newNeighborPages[boundaryIdx] = {
          id: orphan.id,
          layout: selectMergeLayout(combinedCount, combinedIds, poolById),
          photoIds: combinedIds,
          act: orphan.act,
          isExtra: false,
        }
        segs[neighborIdx] = { ...neighbor, pages: newNeighborPages }
        console.log(`[PageEngine] Paridad: foto huérfana fusionada en vecino (${combinedCount} fotos) [DEV]`)
      } else {
        // MOVER: insertar la huérfana como página propia en el tramo vecino.
        // Si vecino era impar (caso habitual), +1 lo hace par sin re-normalizar.
        // Si vecino era par, +1 lo hace impar → re-normalizar.
        if (neighborIsAfter) {
          newNeighborPages.unshift(orphan)
        } else {
          newNeighborPages.push(orphan)
        }
        const reNorm = newNeighborPages.length % 2 === 1
          ? mergeOnceParity(newNeighborPages, poolById)
          : newNeighborPages
        segs[neighborIdx] = { ...neighbor, pages: reNorm }
        console.log(`[PageEngine] Paridad: foto huérfana movida al tramo vecino (${reNorm.length} págs) [DEV]`)
      }

      segs.splice(s, 1)
      changed = true
      break
    }
  }

  return segs.flatMap(seg => seg.pages)
}

function normalizePageParity(pages: Page[], poolById: Map<string, PoolPhoto>): Page[] {
  const result: Page[] = []
  let i = 0

  while (i < pages.length) {
    const isSpread = getLayoutById(pages[i].layout)?.scope === 'spread'

    if (isSpread) {
      result.push(pages[i])
      if (i + 1 < pages.length && pages[i + 1].spreadHalf === 'right') {
        result.push(pages[i + 1])
        i += 2
      } else {
        i += 1
      }
      continue
    }

    // Recolectar tramo normal
    const start = i
    while (i < pages.length && getLayoutById(pages[i].layout)?.scope !== 'spread') {
      i++
    }
    const tract = pages.slice(start, i)

    result.push(...(tract.length % 2 === 1 ? mergeOnceParity(tract, poolById) : tract))
  }

  // Paso 2: absorber páginas de 1 foto en tramos solitarios, cruzando la composición
  return absorbOrphansAcrossSpreads(result, poolById)
}

export function buildPages(
  photos: PoolPhoto[],
  layoutConfig: LayoutConfig = new Map(),
): AlbumPages {
  const pages: Page[] = []
  let pageIndex  = 0
  const groups = groupPhotos(photos)
  const poolById = new Map(photos.map(p => [p.photo.id, p]))

  console.log('[PageEngine] Fotos con orientación:',
    photos.map(p => p.photo.orientation || 'sin-orientacion').join(', ')
  )

  for (const group of groups) {
    const configuredLayout = layoutConfig.get(pageIndex)
    // Prioridad: override manual del usuario > layout del DP > fallback legacy
    const layout: PageLayout = (configuredLayout && canUseLayoutForGroup(configuredLayout, group))
      ? configuredLayout
      : (group.layout as PageLayout | undefined) ?? selectGroupLayout(group)
    const ars = group.photos.map(photoAR)
    const orderedPhotos = orderPhotosForLayout(group.photos, layout, ars)

    // Caso especial: layout de scope 'spread' (una foto cruza 2 páginas)
    const schema = getLayoutById(layout)
    if (schema?.scope === 'spread') {
      const photo = orderedPhotos[0]
      pages.push({
        id: `page-${pageIndex}`,
        layout,
        photoIds: [photo.photo.id],
        act: photo.act,
        isExtra: false,
        spreadHalf: 'left',
      })
      pages.push({
        id: `page-${pageIndex + 1}`,
        layout,
        photoIds: [photo.photo.id],
        act: photo.act,
        isExtra: false,
        spreadHalf: 'right',
      })
      pageIndex  += 2
      continue
    }

    pages.push({
      id: `page-${pageIndex}`,
      layout,
      photoIds: orderedPhotos.map(p => p.photo.id),
      act: orderedPhotos[0].act,
      isExtra: false,
    })

    pageIndex  += 1
  }

  // Normalizar paridad: garantizar que cada tramo de páginas normales sea par
  // para que foldsFromPages empareje todo sin caras huérfanas (estrategia C)
  const normalizedPages = normalizePageParity(pages, poolById)

  // Invariante: layout.photoCount debe coincidir con el número de fotos de la página
  for (const page of normalizedPages) {
    if (page.spreadHalf === 'right') continue  // mitad derecha ya cubierta por 'left'
    const pageSchema = getLayoutById(page.layout)
    if (!pageSchema || pageSchema.scope === 'spread') continue
    if (pageSchema.photoCount !== page.photoIds.length) {
      console.error(
        `[PageEngine] ⚠️ INVARIANTE ROTA: layout '${page.layout}' espera ${pageSchema.photoCount} foto(s)` +
        ` pero '${page.id}' tiene ${page.photoIds.length}:`,
        page.photoIds,
      )
    }
  }

  return {
    pages: normalizedPages,
    unusedPhotoIds: [],
    totalPhotosUsed: photos.length,
  }
}

/**
 * Cambia el layout de una página específica.
 * Recalcula todas las páginas en cascada para
 * que nunca queden espacios vacíos.
 */
export function changePageLayout(
  photos: PoolPhoto[],
  currentConfig: LayoutConfig,
  pageIndex: number,
  newLayout: PageLayout,
): { config: LayoutConfig; pages: AlbumPages } {
  const newConfig = new Map(currentConfig)
  newConfig.set(pageIndex, newLayout)
  const pages = buildPages(photos, newConfig)
  return { config: newConfig, pages }
}

/**
 * Helper: extrae el pool de fotos ordenado desde
 * los spreads del AlbumBlueprint (formato viejo de la IA).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractPhotoPool(spreads: any, manualOrder?: string[]): PoolPhoto[] {
  if (!Array.isArray(spreads)) {
    console.warn('[Pool] spreads no es array:', typeof spreads)
    return []
  }
  const seen = new Set<string>()
  const pool: PoolPhoto[] = []
  for (const spread of spreads) {
    if (!spread || !Array.isArray(spread.photos)) continue
    for (const photo of spread.photos) {
      if (!photo?.id) continue
      if (seen.has(photo.id)) continue
      seen.add(photo.id)
      pool.push({ photo, act: spread.act || 'desarrollo' })
    }
  }

  if (manualOrder && manualOrder.length > 0) {
    // manualOrder es la lista DEFINITIVA de fotos del álbum.
    // Si una foto está en spreads pero no en manualOrder, fue eliminada por el usuario.
    // NO appendear "huérfanos" — eso re-introducía fotos eliminadas al final.
    const byId = new Map(pool.map(item => [item.photo.id, item]))
    const reordered: typeof pool = []
    for (const id of manualOrder) {
      const item = byId.get(id)
      if (item) reordered.push(item)
    }
    return reordered
  }

  return pool
}
