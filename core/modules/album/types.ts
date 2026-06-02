import type { ActId } from '@/core/contracts/AlbumBlueprint'

// Layouts por PÁGINA individual
export type PageLayout =
  | 'single'
  | 'stack-2'
  | 'side-2'
  | 'grid-3'
  | 'grid-4'
  | 'portrait'
  | 'hero-spread'
  | 'hero-3-top'
  | 'hero-2-bottom'
  | 'hero-3-left'
  | 'hero-3-right'
  | 'trio-row'
  | 'trio-column'
  | 'trio-portrait'
  | 'hero-4-grid'
  | 'mosaic-5'
  | 'portrait-pair'
  | 'quad-mixed'

// Cuántas fotos consume cada layout
export const PHOTOS_PER_LAYOUT: Record<PageLayout, number> = {
  'single': 1,
  'stack-2': 2,
  'side-2': 2,
  'grid-3': 3,
  'grid-4': 4,
  'portrait': 1,
  'hero-spread': 1,
  'hero-3-top': 4,
  'hero-2-bottom': 3,
  'hero-3-left': 4,
  'hero-3-right': 4,
  'trio-row': 3,
  'trio-column': 3,
  'trio-portrait': 3,
  'hero-4-grid': 5,
  'mosaic-5': 5,
  'portrait-pair': 2,
  'quad-mixed': 3,
}

// Ajuste de foto dentro de su marco (zoom + pan)
export interface PhotoPlacement {
  zoom: number      // 1.0 = ajustado, hasta 3.0
  offsetX: number   // -50 a 50 (% de desplazamiento)
  offsetY: number   // -50 a 50
}

export const DEFAULT_PLACEMENT: PhotoPlacement = {
  zoom: 1.0,
  offsetX: 0,
  offsetY: 0,
}

// Una página del álbum
export interface Page {
  id: string
  layout: PageLayout
  photoIds: string[]          // IDs de fotos que ocupa
  act: ActId
  isExtra: boolean            // página agregada con costo
  spreadHalf?: 'left' | 'right'  // solo si el layout es scope: 'spread'
}

// Configuración de layout por índice de página
export type LayoutConfig = Map<number, PageLayout>

// Resultado del motor
export interface AlbumPages {
  pages: Page[]
  unusedPhotoIds: string[]    // fotos que no caben
  totalPhotosUsed: number
}
