import type { PhotoAsset, ActId } from '@/core/contracts/AlbumBlueprint'
import type { Page, PageLayout, LayoutConfig, AlbumPages } from './types'
import { PHOTOS_PER_LAYOUT } from './types'

/**
 * Motor central: distribuye fotos en páginas según
 * la configuración de layouts. NUNCA deja páginas vacías.
 *
 * @param photos       pool ordenado de fotos (con su acto)
 * @param layoutConfig layout elegido por el usuario para cada página
 * @param extraPages   número de páginas extra agregadas con costo
 */
export function buildPages(
  photos: { photo: PhotoAsset; act: ActId }[],
  layoutConfig: LayoutConfig = new Map(),
  extraPages: number = 0,
): AlbumPages {
  const pages: Page[] = []
  let photoIndex = 0
  let pageIndex  = 0

  while (photoIndex < photos.length) {
    // Layout para esta página (default 'single')
    const layout = layoutConfig.get(pageIndex) || 'single'
    const needed = PHOTOS_PER_LAYOUT[layout]

    // Caso especial: cross-page (foto cruza 2 páginas)
    if (layout === 'cross-left') {
      const photo = photos[photoIndex]
      // Página izquierda
      pages.push({
        id: `page-${pageIndex}`,
        layout: 'cross-left',
        photoIds: [photo.photo.id],
        act: photo.act,
        isExtra: pageIndex >= photos.length,
      })
      // Página derecha (misma foto)
      pages.push({
        id: `page-${pageIndex + 1}`,
        layout: 'cross-right',
        photoIds: [photo.photo.id],
        act: photo.act,
        isExtra: false,
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
      // Degradar el layout al que quepa
      if (available >= 2) {
        actualLayout = 'side-2'
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
export function extractPhotoPool(
  spreads: { photos: PhotoAsset[]; act: ActId }[],
): { photo: PhotoAsset; act: ActId }[] {
  const seen = new Set<string>()
  const pool: { photo: PhotoAsset; act: ActId }[] = []

  for (const spread of spreads) {
    for (const photo of spread.photos) {
      if (seen.has(photo.id)) continue
      seen.add(photo.id)
      pool.push({ photo, act: spread.act })
    }
  }
  return pool
}
