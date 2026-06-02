import type { PhotoOrientation } from '@/core/contracts/AlbumBlueprint'

export interface LayoutSchema {
  id: string                  // 'hero-spread'
  name: string                // 'Foto heroica a doble página' (para UI del editor)
  photoCount: number          // cuántas fotos consume
  scope?: 'page' | 'spread'  // default 'page'. Spread = ocupa 2 páginas.
  grid: {
    columns: string           // ej: '1fr 1fr 1fr'
    rows: string              // ej: '1fr 2fr'
    areas: string             // ej: '"a b c" "d d d"'
  }
  slots: string[]             // ['a', 'b', 'c', 'd'] — mismo orden que photos
  // Casos especiales
  innerPadding?: string       // ej: '15%' (para portrait con aire)
  disableMargin?: boolean     // bleed total (para cross-page)
  slotConfig?: Array<{
    objectPosition?: string   // override fijo de object-position
    disablePlacement?: boolean // ignora zoom/pan del placement
  }>
  // Opcional, para futuro autoLayout
  slotOrientations?: Array<PhotoOrientation[]>
}
