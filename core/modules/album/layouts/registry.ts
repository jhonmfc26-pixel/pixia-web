import type { LayoutSchema } from './types'

/**
 * Registry de layouts. Para agregar uno nuevo, solo añade un objeto aquí.
 * El LayoutRenderer lo pinta automáticamente con CSS Grid.
 */
export const LAYOUTS: LayoutSchema[] = [
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
    id: 'hero-spread',
    name: 'Foto heroica a doble página',
    photoCount: 1,
    scope: 'spread',
    grid: { columns: '1fr', rows: '1fr', areas: '"a"' },
    slots: ['a'],
    disableMargin: true,
  },
]
