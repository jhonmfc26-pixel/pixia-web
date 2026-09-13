/**
 * Geometría de fotos individuales (aspect ratio, clasificación de orientación)
 * — fuente única compartida entre el motor de layouts y el análisis de
 * upload, para que sus fallbacks/umbrales no diverjan con el tiempo.
 */
import type { PoolPhoto } from './groupPhotos'

/** AR de referencia por bucket de orientación — fallback cuando faltan width/height reales. */
export const FALLBACK_AR_BY_ORIENTATION = {
  portrait: 0.72,
  square: 1.0,
  landscape: 1.4,
} as const

/** AR real de una foto. Fallback a constantes por orientación si faltan dimensiones. */
export function photoAR(item: PoolPhoto): number {
  const photo = item.photo
  const w = photo.width ?? 0
  const h = photo.height ?? 0
  if (w > 0 && h > 0) return w / h
  const ori = photo.orientation ?? 'landscape'
  return FALLBACK_AR_BY_ORIENTATION[ori] ?? FALLBACK_AR_BY_ORIENTATION.landscape
}

// Umbrales de clasificación de orientación por ratio ancho/alto — fuente única
// entre el análisis principal (usePhotoAnalysis) y cualquier re-detección de
// fallback (buildPixiaBook). Antes vivían duplicados con valores ligeramente
// distintos (1.15/0.87 vs 1.2/0.85); unificados en los de usePhotoAnalysis,
// el análisis que corre siempre en el flujo principal.
export const ORIENTATION_RATIO_LANDSCAPE_MIN = 1.15
export const ORIENTATION_RATIO_PORTRAIT_MAX = 0.87

export function classifyOrientation(ratio: number): 'landscape' | 'portrait' | 'square' {
  if (ratio > ORIENTATION_RATIO_LANDSCAPE_MIN) return 'landscape'
  if (ratio < ORIENTATION_RATIO_PORTRAIT_MAX) return 'portrait'
  return 'square'
}
