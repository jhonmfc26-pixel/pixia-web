import type { LayoutSchema } from './types'

/**
 * Layouts exclusivos del formato vertical 21×28 (página 3:4).
 *
 * En página vertical los dípticos lado a lado quedan como tiras (10,5×28 cm,
 * 0.38) y se excluyen solos por geometría (layoutFit). Lo natural de una
 * página alta es apilar horizontales: 21×14 cm es justo 3:2, la proporción
 * de la foto de cámara o celular en horizontal. Estos diseños aprovechan eso
 * para los álbumes de viaje, que traen muchas fotos y casi todas horizontales.
 *
 * Proporciones de cada slot ya medidas en página 21×28 (ancho/alto):
 *   v-duo-air     2 horizontales con aire          1.50 · 1.50
 *   v-trio-air    3 horizontales con aire          1.50 · 1.50 · 1.50
 *   v-hero-3      horizontal arriba + 3 verticales 1.50 · 0.50 ×3
 *   v-mixed-4     2 verticales + 2 horizontales    0.56 ×2 · 1.13 ×2
 *   v-travel-5    horizontal grande + 4 pequeñas   1.50 ×5
 *   v-mosaic-5    vertical alta + 4 pequeñas       0.56 · 1.13 ×4
 *
 * Comparten ids en los dos catálogos (base y Ritmo) — ver registry.ts.
 */
export const VERTICAL_LAYOUTS = [
  {
    id: 'v-duo-air',
    name: 'Dos horizontales con aire',
    photoCount: 2,
    hasAir: true,
    tier: 'aire',
    onlyVertical: true,
    grid: { columns: '0.1fr 0.8fr 0.1fr', rows: '1.87fr 11.2fr 1.87fr 11.2fr 1.87fr', areas: '". . ." ". a ." ". . ." ". b ." ". . ."' },
    slots: ['a', 'b'],
  },
  {
    id: 'v-trio-air',
    name: 'Tres horizontales con aire',
    photoCount: 3,
    hasAir: true,
    tier: 'aire',
    onlyVertical: true,
    grid: { columns: '0.215fr 0.57fr 0.215fr', rows: '1fr 8fr 1fr 8fr 1fr 8fr 1fr', areas: '". . ." ". a ." ". . ." ". b ." ". . ." ". c ." ". . ."' },
    slots: ['a', 'b', 'c'],
  },
  {
    id: 'v-hero-3',
    name: 'Horizontal arriba, tres verticales abajo',
    photoCount: 4,
    tier: 'full-bleed',
    onlyVertical: true,
    grid: { columns: '1fr 1fr 1fr', rows: '1fr 1fr', areas: '"a a a" "b c d"' },
    slots: ['a', 'b', 'c', 'd'],
  },
  {
    id: 'v-mixed-4',
    name: 'Dos verticales y dos horizontales',
    photoCount: 4,
    tier: 'full-bleed',
    onlyVertical: true,
    grid: { columns: '1fr 1fr', rows: '2fr 1fr', areas: '"a b" "c d"' },
    slots: ['a', 'b', 'c', 'd'],
  },
  {
    id: 'v-travel-5',
    name: 'Viaje: horizontal grande y cuatro pequeñas',
    photoCount: 5,
    tier: 'full-bleed',
    onlyVertical: true,
    grid: { columns: '1fr 1fr', rows: '2fr 1fr 1fr', areas: '"a a" "b c" "d e"' },
    slots: ['a', 'b', 'c', 'd', 'e'],
  },
  {
    id: 'v-mosaic-5',
    name: 'Vertical alta y cuatro pequeñas',
    photoCount: 5,
    tier: 'full-bleed',
    onlyVertical: true,
    grid: { columns: '1fr 1fr', rows: '1fr 1fr 1fr', areas: '"a b" "a c" "d e"' },
    slots: ['a', 'b', 'c', 'd', 'e'],
  },
] as const satisfies readonly LayoutSchema[]

export type VerticalLayoutId = (typeof VERTICAL_LAYOUTS)[number]['id']
