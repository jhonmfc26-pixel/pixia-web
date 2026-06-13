import type { ActId } from '@/core/contracts/AlbumBlueprint'
import { LAYOUTS, type LayoutId } from './layouts/registry'

// Layouts por PÁGINA individual. El vocabulario nace en el registry.
export type PageLayout = LayoutId

// Cuántas fotos consume cada layout, derivado del registry.
export const PHOTOS_PER_LAYOUT = Object.fromEntries(
  LAYOUTS.map(layout => [layout.id, layout.photoCount])
) as Record<PageLayout, number>

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
