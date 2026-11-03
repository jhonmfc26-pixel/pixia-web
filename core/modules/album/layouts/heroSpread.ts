import type { LayoutSchema } from './types'

/**
 * Definición única de hero-spread — extraída a su propio archivo porque la
 * necesitan DOS registries (el base en registry.ts y el de Ritmo Pixia en
 * ritmoPixiaRegistry.ts) sin que uno importe al otro (evita import circular).
 *
 * segmentChapter.ts elige este id de forma hardcodeada para el opener de
 * capítulo landscape — tiene que existir y resolver igual sin importar el
 * estado del flag NEXT_PUBLIC_RITMO_LAYOUTS. No es parte de la migración de
 * Fase B1 (el spread mejorado con regla de gutter es de una fase después) —
 * se transporta sin cambios, no se "migra".
 */
export const HERO_SPREAD_LAYOUT = {
  id: 'hero-spread',
  name: 'Foto heroica a doble página',
  photoCount: 1,
  scope: 'spread',
  grid: { columns: '1fr', rows: '1fr', areas: '"a"' },
  slots: ['a'],
  disableMargin: true,
} as const satisfies LayoutSchema
