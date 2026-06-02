/**
 * ⚠️ SISTEMA CANÓNICO TEMPORAL
 *
 * Este motor es el sistema activo HOY pero NO es el destino final
 * de la arquitectura. Existe porque hay 2 conjuntos de nombres de
 * layouts incompatibles en el proyecto:
 *
 *   - Contrato (AlbumBlueprint):  full, double, duo-v, duo-h, trio, hero-2, portrait
 *   - pageEngine (este archivo):  single, stack-2, side-2, grid-3, grid-4, portrait, hero-spread
 *   - IA (/api/editorial):        full-bleed, split-horizontal, editorial-right
 *
 * El plan a futuro es unificar todo al vocabulario del contrato y
 * deprecar este archivo. Mientras tanto, este motor es la fuente
 * de verdad para el viewer y el editor.
 */
import type { PhotoAsset, ActId } from '@/core/contracts/AlbumBlueprint'
import type { Page, PageLayout, LayoutConfig, AlbumPages } from './types'
import { PHOTOS_PER_LAYOUT } from './types'
import { getLayoutById } from './layouts/helpers'

// Layouts compatibles por orientación — guía la decisión automática
const COMPATIBLE_LAYOUTS: Record<string, PageLayout[]> = {
  landscape: ['single', 'stack-2', 'grid-3', 'grid-4'],
  portrait:  ['portrait', 'side-2', 'grid-4'],
  square:    ['single', 'stack-2', 'side-2', 'grid-4'],
}

export function isCompatibleLayout(photo: PhotoAsset, layout: PageLayout): boolean {
  const ori = photo.orientation || 'landscape'
  return COMPATIBLE_LAYOUTS[ori]?.includes(layout) ?? true
}

/**
 * Motor central: distribuye fotos en páginas según
 * la configuración de layouts. NUNCA deja páginas vacías.
 *
 * @param photos       pool ordenado de fotos (con su acto)
 * @param layoutConfig layout elegido por el usuario para cada página
 */
function autoLayout(
  current: { photo: PhotoAsset; act: ActId },
  next?: { photo: PhotoAsset; act: ActId },
): PageLayout {
  const orientation = current.photo.orientation || 'landscape'
  console.log('[PageEngine] autoLayout:', orientation, next?.photo.orientation || 'no-next')

  // Dos portrait juntas → side-2 (lado a lado)
  if (next && orientation === 'portrait' && next.photo.orientation === 'portrait') {
    return 'side-2'
  }
  // Dos landscape juntas → stack-2 (apiladas)
  // Regla: portrait NUNCA en stack-2
  if (next && orientation === 'landscape' && next.photo.orientation === 'landscape') {
    return 'stack-2'
  }
  // Landscape sola o square → single
  // Regla: landscape NUNCA en portrait layout
  if (orientation === 'landscape' || orientation === 'square') return 'single'
  // Portrait sola → portrait (con aire)
  return 'portrait'
}

export function buildPages(
  photos: { photo: PhotoAsset; act: ActId }[],
  layoutConfig: LayoutConfig = new Map(),
): AlbumPages {
  const pages: Page[] = []
  let photoIndex = 0
  let pageIndex  = 0

  console.log('[PageEngine] Fotos con orientación:',
    photos.map(p => p.photo.orientation || 'sin-orientacion').join(', ')
  )

  while (photoIndex < photos.length) {
    const layout = layoutConfig.get(pageIndex) ||
      autoLayout(photos[photoIndex], photos[photoIndex + 1])
    const needed = PHOTOS_PER_LAYOUT[layout]

    // Caso especial: layout de scope 'spread' (una foto cruza 2 páginas)
    const schema = getLayoutById(layout)
    if (schema?.scope === 'spread') {
      const photo = photos[photoIndex]
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
      photoIndex += 1
      pageIndex  += 2
      continue
    }

    // ¿Hay suficientes fotos para este layout?
    const available = photos.length - photoIndex
    let actualLayout: PageLayout = layout
    let actualNeeded = needed

    if (available < needed) {
      // Degradar el layout al que quepa, respetando compatibilidad de orientación
      if (available >= 2) {
        const firstPhoto = photos[photoIndex].photo
        actualLayout = isCompatibleLayout(firstPhoto, 'side-2') ? 'side-2' : 'stack-2'
        actualNeeded = 2
      } else {
        actualLayout = 'single'
        actualNeeded = 1
      }
    }

    // Tomar las fotos para esta página
    const pagePhotos = photos.slice(photoIndex, photoIndex + actualNeeded)

    pages.push({
      id: `page-${pageIndex}`,
      layout: actualLayout,
      photoIds: pagePhotos.map(p => p.photo.id),
      act: pagePhotos[0].act,
      isExtra: false,
    })

    photoIndex += actualNeeded
    pageIndex  += 1
  }

  return {
    pages,
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
  photos: { photo: PhotoAsset; act: ActId }[],
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
export function extractPhotoPool(spreads: any): { photo: PhotoAsset; act: ActId }[] {
  if (!Array.isArray(spreads)) {
    console.warn('[Pool] spreads no es array:', typeof spreads)
    return []
  }
  const seen = new Set<string>()
  const pool: { photo: PhotoAsset; act: ActId }[] = []
  for (const spread of spreads) {
    if (!spread || !Array.isArray(spread.photos)) continue
    for (const photo of spread.photos) {
      if (!photo?.id) continue
      if (seen.has(photo.id)) continue
      seen.add(photo.id)
      pool.push({ photo, act: spread.act || 'desarrollo' })
    }
  }
  return pool
}
