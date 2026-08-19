import type { LayoutSchema } from './types'

/**
 * Registry de layouts. Para agregar uno nuevo, solo añade un objeto aquí.
 * El LayoutRenderer lo pinta automáticamente con CSS Grid.
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
    name: 'Vertical con aire',
    photoCount: 1,
    grid: { columns: '1fr', rows: '1fr', areas: '"a"' },
    slots: ['a'],
    innerPadding: '15%',
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
  {
    id: 'hero-3-right',
    name: '3 izq + Hero der',
    photoCount: 4,
    grid: { columns: '1fr 2fr', rows: '1fr 1fr 1fr', areas: '"b a" "c a" "d a"' },
    slots: ['a', 'b', 'c', 'd'],
  },
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
    name: 'Par vertical con aire',
    photoCount: 2,
    grid: { columns: '1fr 1fr', rows: '1fr', areas: '"a b"' },
    slots: ['a', 'b'],
    innerPadding: '10%',
  },
  {
    id: 'quad-mixed',
    name: 'Mezcla irregular',
    photoCount: 3,
    grid: { columns: '1fr 1fr', rows: '1fr 1fr', areas: '"a a" "b c"' },
    slots: ['a', 'b', 'c'],
  },
  {
    id: 'hero-spread',
    name: 'Foto heroica a doble página',
    photoCount: 1,
    scope: 'spread',
    grid: { columns: '1fr', rows: '1fr', areas: '"a"' },
    slots: ['a'],
    disableMargin: true,
  },

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

export type LayoutId = (typeof LAYOUT_REGISTRY)[number]['id']

export const LAYOUTS: readonly LayoutSchema[] = LAYOUT_REGISTRY
