import type { ActId } from '@/core/contracts/AlbumBlueprint'

// Layouts por PÁGINA individual
export type PageLayout =
  | 'single'       // 1 foto, página completa
  | 'stack-2'      // 2 fotos apiladas vertical
  | 'side-2'       // 2 fotos lado a lado
  | 'grid-3'       // 3 fotos
  | 'grid-4'       // 4 fotos (2x2)
  | 'portrait'     // 1 foto vertical con margen
  | 'hero-spread'  // foto heroica a doble página (scope: 'spread')

// Cuántas fotos consume cada layout
export const PHOTOS_PER_LAYOUT: Record<PageLayout, number> = {
  'single': 1,
  'stack-2': 2,
  'side-2': 2,
  'grid-3': 3,
  'grid-4': 4,
  'portrait': 1,
  'hero-spread': 1,
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
