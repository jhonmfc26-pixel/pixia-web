import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { Page, PageLayout, LayoutConfig, AlbumPages } from './types'
import { getLayoutById } from './layouts/helpers'
import { groupPhotos, type PhotoGroup, type PoolPhoto } from './groupPhotos'

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
  current: PoolPhoto,
  next?: PoolPhoto,
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

function scoreOf(item: PoolPhoto): number {
  return item.photo.score?.finalScore ?? 0
}

function orderForSlots(photos: PoolPhoto[]): PoolPhoto[] {
  return [...photos].sort((a, b) => scoreOf(b) - scoreOf(a))
}

function selectGroupLayout(group: PhotoGroup): PageLayout {
  const [first, second] = group.photos
  const count = group.photos.length

  if (count === 1) {
    const orientation = first.photo.orientation || 'landscape'
    if (group.isChapterOpener) {
      if (orientation === 'landscape') return 'hero-spread'
      if (orientation === 'portrait') return 'portrait'
    }
    return orientation === 'portrait' ? 'portrait' : 'single'
  }

  if (count === 2) return autoLayout(first, second)

  if (count === 3) {
    const orientations = group.photos.map(item => item.photo.orientation || 'landscape')
    if (orientations.every(orientation => orientation === 'landscape')) return 'trio-row'
    if (orientations.every(orientation => orientation === 'portrait')) return 'trio-column'
    return 'grid-3'
  }

  if (count === 4) return 'hero-3-left'

  return 'mosaic-5'
}

function canUseLayoutForGroup(layout: PageLayout, group: PhotoGroup): boolean {
  const schema = getLayoutById(layout)
  if (!schema) return false
  return schema.photoCount === group.photos.length
}

export function buildPages(
  photos: PoolPhoto[],
  layoutConfig: LayoutConfig = new Map(),
): AlbumPages {
  const pages: Page[] = []
  let pageIndex  = 0
  const groups = groupPhotos(photos)

  console.log('[PageEngine] Fotos con orientación:',
    photos.map(p => p.photo.orientation || 'sin-orientacion').join(', ')
  )

  for (const group of groups) {
    const configuredLayout = layoutConfig.get(pageIndex)
    const layout = configuredLayout && canUseLayoutForGroup(configuredLayout, group)
      ? configuredLayout
      : selectGroupLayout(group)
    const orderedPhotos = orderForSlots(group.photos)

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

  // Invariante: layout.photoCount debe coincidir con el número de fotos de la página
  for (const page of pages) {
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
