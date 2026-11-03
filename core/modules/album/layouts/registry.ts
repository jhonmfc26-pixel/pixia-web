import type { LayoutSchema } from './types'
import { HERO_SPREAD_LAYOUT } from './heroSpread'
import { RITMO_LAYOUTS_ENABLED } from './ritmoFlag'
import { RITMO_PIXIA_LAYOUTS } from './ritmoPixiaRegistry'

/**
 * Registry de layouts. Para agregar uno nuevo, solo añade un objeto aquí.
 * El LayoutRenderer lo pinta automáticamente con CSS Grid.
 *
 * Esta es la base — el comportamiento de hoy, sin cambios. Con
 * NEXT_PUBLIC_RITMO_LAYOUTS=true el motor usa RITMO_PIXIA_LAYOUTS en su
 * lugar (ver el export LAYOUTS más abajo) — este array no se toca ni se
 * referencia desde ahí salvo por hero-spread, que ambos comparten vía
 * heroSpread.ts para no duplicarlo.
 */
const LAYOUT_REGISTRY = [
  {
    id: 'single',
    name: 'Foto única',
    photoCount: 1,
    grid: { columns: '1fr', rows: '1fr', areas: '"a"' },
    slots: ['a'],
  },
  {
    id: 'stack-2',
    name: 'Dos apiladas',
    photoCount: 2,
    grid: { columns: '1fr', rows: '1fr 1fr', areas: '"a" "b"' },
    slots: ['a', 'b'],
  },
  {
    id: 'side-2',
    name: 'Dos lado a lado',
    photoCount: 2,
    grid: { columns: '1fr 1fr', rows: '1fr', areas: '"a b"' },
    slots: ['a', 'b'],
  },
  {
    id: 'grid-3',
    name: '1 grande + 2 pequeñas',
    photoCount: 3,
    grid: { columns: '1fr 1fr', rows: '1fr 1fr', areas: '"a b" "a c"' },
    slots: ['a', 'b', 'c'],
  },
  {
    id: 'grid-4',
    name: '4 fotos en cuadrícula',
    photoCount: 4,
    grid: { columns: '1fr 1fr', rows: '1fr 1fr', areas: '"a b" "c d"' },
    slots: ['a', 'b', 'c', 'd'],
  },
  {
    id: 'portrait',
    name: 'Vertical con aire suave',
    photoCount: 1,
    hasAir: true,
    // Rediseñado — antes tenía innerPadding:'15%' (padding CSS simétrico),
    // geométricamente indistinguible de 'single' para el motor: un padding
    // simétrico sobre página cuadrada no cambia el AR del slot (se achica
    // igual en ancho y alto), solo el área — y el algoritmo de selección
    // (bestAssignment/rankLayoutsForPhotos) solo mira AR, nunca área. Con eso
    // 'single' le ganaba el desempate siempre, 0% de selección real (ver
    // auditoría "Inventario y uso del sistema de layouts").
    // Ahora usa el mismo mecanismo que solo-portrait-air (celdas '.' que
    // rompen la simetría) pero con margen más angosto — AR de slot 0.84
    // (frente al 0.72 de solo-portrait-air) — para ocupar un punto propio en
    // el espectro "aire" en vez de duplicarlo: aire suave para fotos casi
    // cuadradas que igual quieren un respiro, no el ajuste ceñido de
    // solo-portrait-air.
    grid: { columns: '0.08fr 0.84fr 0.08fr', rows: '1fr', areas: '". a ."' },
    slots: ['a'],
  },
  {
    id: 'hero-3-top',
    name: 'Hero abajo, 3 arriba',
    photoCount: 4,
    grid: { columns: '1fr 1fr 1fr', rows: '1fr 2fr', areas: '"a b c" "d d d"' },
    slots: ['a', 'b', 'c', 'd'],
  },
  {
    id: 'hero-2-bottom',
    name: 'Hero arriba, 2 abajo',
    photoCount: 3,
    grid: { columns: '1fr 1fr', rows: '2fr 1fr', areas: '"a a" "b c"' },
    slots: ['a', 'b', 'c'],
  },
  {
    id: 'hero-3-left',
    name: 'Hero izq + 3 derecha',
    photoCount: 4,
    grid: { columns: '2fr 1fr', rows: '1fr 1fr 1fr', areas: '"a b" "a c" "a d"' },
    slots: ['a', 'b', 'c', 'd'],
  },
  // hero-3-right (3 izq + Hero der) se borró: era geométricamente idéntico a
  // hero-3-left (mismas áreas/AR de slot, solo el nombre sugería una imagen
  // especular distinta) — el motor nunca lo elegía, perdía el desempate por
  // orden de array siempre. Ver auditoría "Inventario y uso del sistema de
  // layouts" (layouts muertos).
  {
    id: 'trio-row',
    name: 'Trío horizontal',
    photoCount: 3,
    grid: { columns: '1fr 1fr 1fr', rows: '1fr', areas: '"a b c"' },
    slots: ['a', 'b', 'c'],
  },
  {
    id: 'trio-column',
    name: 'Trío vertical',
    photoCount: 3,
    grid: { columns: '1fr', rows: '1fr 1fr 1fr', areas: '"a" "b" "c"' },
    slots: ['a', 'b', 'c'],
  },
  {
    id: 'trio-portrait',
    name: 'Dos arriba, una ancha',
    photoCount: 3,
    grid: { columns: '1fr 1fr', rows: '2fr 1fr', areas: '"a b" "c c"' },
    slots: ['a', 'b', 'c'],
  },
  {
    id: 'hero-4-grid',
    name: 'Hero + cuádruple',
    photoCount: 5,
    grid: { columns: '2fr 1fr 1fr', rows: '1fr 1fr', areas: '"a b c" "a d e"' },
    slots: ['a', 'b', 'c', 'd', 'e'],
  },
  {
    id: 'mosaic-5',
    name: 'Mosaico de 5',
    photoCount: 5,
    grid: { columns: '1fr 1fr 1fr', rows: '2fr 1fr', areas: '"a a b" "c d e"' },
    slots: ['a', 'b', 'c', 'd', 'e'],
  },
  {
    id: 'portrait-pair',
    name: 'Par vertical con aire suave',
    photoCount: 2,
    hasAir: true,
    // Mismo rediseño que 'portrait' — ver ese comentario. AR de slot 0.833
    // (frente al 0.714 de duo-portrait-air): margen suave, no el ajuste
    // ceñido.
    grid: { columns: '1fr 1fr', rows: '0.2fr 0.6fr 0.2fr', areas: '". ." "a b" ". ."' },
    slots: ['a', 'b'],
  },
  {
    id: 'quad-mixed',
    name: 'Mezcla irregular',
    photoCount: 3,
    grid: { columns: '1fr 1fr', rows: '1fr 1fr', areas: '"a a" "b c"' },
    slots: ['a', 'b', 'c'],
  },
  HERO_SPREAD_LAYOUT,

  // ── Layouts con aire (celdas '.' = margen de papel, fondo crema) ─────────────
  // El área vacía crea márgenes deliberados que evitan recortar fotos con AR muy
  // distinto al de la página. Se usa solo cuando ahorra >12 pp de pérdida
  // (ver AIR_PENALTY en layoutFit.ts).

  {
    id: 'solo-portrait-air',
    name: 'Vertical con margen',
    photoCount: 1,
    hasAir: true,
    // Slot AR = 0.72/1.0 = 0.72 (encaja fotos portrait, tC=1.0)
    grid: { columns: '0.14fr 0.72fr 0.14fr', rows: '1fr', areas: '". a ."' },
    slots: ['a'],
  },
  {
    id: 'solo-landscape-air',
    name: 'Horizontal con margen',
    photoCount: 1,
    hasAir: true,
    // Slot AR = 1.0/0.714 ≈ 1.40 (encaja fotos landscape, tR=1.0)
    grid: { columns: '1fr', rows: '0.143fr 0.714fr 0.143fr', areas: '"." "a" "."' },
    slots: ['a'],
  },
  {
    id: 'duo-portrait-air',
    name: 'Dos verticales con margen',
    photoCount: 2,
    hasAir: true,
    // Slot AR = 1.0/1.40 ≈ 0.71 (encaja pares de fotos portrait, tR=1.0)
    grid: { columns: '1fr 1fr', rows: '0.15fr 0.70fr 0.15fr', areas: '". ." "a b" ". ."' },
    slots: ['a', 'b'],
  },
  {
    id: 'duo-landscape-air',
    name: 'Dos horizontales con margen',
    photoCount: 2,
    hasAir: true,
    // Slot AR = 0.70/0.50 = 1.40 (encaja pares de fotos landscape, tC=1.0)
    grid: { columns: '0.15fr 0.70fr 0.15fr', rows: '1fr 1fr', areas: '". a ." ". b ."' },
    slots: ['a', 'b'],
  },
  {
    id: 'trio-portrait-air',
    name: 'Trío vertical con margen',
    photoCount: 3,
    hasAir: true,
    // Slot AR = 1.0/1.38 ≈ 0.72 (encaja tríos de fotos portrait, tR=1.0)
    grid: { columns: '1fr 1fr 1fr', rows: '0.27fr 0.46fr 0.27fr', areas: '". . ." "a b c" ". . ."' },
    slots: ['a', 'b', 'c'],
  },
] as const satisfies readonly LayoutSchema[]

// Unión de los ids base + los ids nuevos que solo existen en el catálogo
// Ritmo Pixia (flag ON) — el tipo tiene que cubrir ambos estados del flag
// porque TS se resuelve en build time, antes de que exista el env var en
// runtime. Los 5 ids nuevos que no están ya en LAYOUT_REGISTRY (los demás
// del catálogo Ritmo reusan un id existente, aunque cambien de geometría):
// trio-air, quad-soft, hero-banner-5, grid-5, quintet-air.
type RitmoOnlyLayoutId = 'trio-air' | 'quad-soft' | 'hero-banner-5' | 'grid-5' | 'quintet-air'

export type LayoutId = (typeof LAYOUT_REGISTRY)[number]['id'] | RitmoOnlyLayoutId

export const LAYOUTS: readonly LayoutSchema[] = RITMO_LAYOUTS_ENABLED
  ? RITMO_PIXIA_LAYOUTS
  : LAYOUT_REGISTRY
