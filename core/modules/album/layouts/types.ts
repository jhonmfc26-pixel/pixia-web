type LayoutPhotoOrientation = 'landscape' | 'portrait' | 'square'

/**
 * Densidad de página — full-bleed (100% foto), equilibrado (~78-90%, aire
 * sutil) o aire (~58-72%, margen crema deliberado). Ver documento de diseño
 * "Ritmo Pixia". Transportado desde Fase B1 en adelante; el motor de
 * selección todavía NO lo usa para nada (eso es Fase B2, el algoritmo de
 * ritmo/alternancia) — hoy es solo metadata que viaja con el schema.
 */
export type DensityTier = 'full-bleed' | 'equilibrado' | 'aire'

export interface LayoutSchema {
  readonly id: string                  // 'hero-spread'
  readonly name: string                // 'Foto heroica a doble página' (para UI del editor)
  readonly photoCount: number          // cuántas fotos consume
  readonly scope?: 'page' | 'spread'  // default 'page'. Spread = ocupa 2 páginas.
  readonly grid: {
    readonly columns: string           // ej: '1fr 1fr 1fr'
    readonly rows: string              // ej: '1fr 2fr'
    readonly areas: string             // ej: '"a b c" "d d d"'
  }
  readonly slots: readonly string[]    // ['a', 'b', 'c', 'd'] — mismo orden que photos
  // Casos especiales
  readonly innerPadding?: string       // ej: '15%' (para portrait con aire)
  readonly disableMargin?: boolean     // bleed total (para cross-page)
  readonly slotConfig?: ReadonlyArray<{
    readonly objectPosition?: string   // override fijo de object-position
    readonly disablePlacement?: boolean // ignora zoom/pan del placement
  }>
  // true cuando el layout usa celdas vacías ('.') para crear márgenes de papel.
  // El renderer debe pintar esas celdas con color de papel (crema), nunca negro.
  readonly hasAir?: boolean
  // Opcional, para futuro autoLayout
  readonly slotOrientations?: ReadonlyArray<ReadonlyArray<LayoutPhotoOrientation>>
  /** Ver DensityTier arriba. Ausente en los layouts base (pre-Ritmo Pixia) — no se les asignó retroactivamente. */
  readonly tier?: DensityTier
}
