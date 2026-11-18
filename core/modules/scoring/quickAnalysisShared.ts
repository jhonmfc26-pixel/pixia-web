/**
 * Cálculos que comparten el worker de análisis y su respaldo en el hilo
 * principal, para que los dos den exactamente lo mismo. Sin DOM.
 */
import { sampleSize, scoreFromPixels, type PhotoScore } from './photoScorer'

/** Miniatura de la grilla del paso 2: lado mayor 150 px, JPEG 0,6 (~8–12 KB). */
export const THUMB_MAX = 150
export const THUMB_QUALITY = 0.6

/**
 * Lado mayor de las dimensiones que se guardan en el análisis. Antes salían de
 * una copia de 800 px que se armaba solo para medirla; se mantiene la misma
 * cuenta para que el álbum se arme igual que siempre.
 */
const ANALYSIS_MAX = 800
/** Calidad JPEG de esa copia: el puntaje se mide sobre ella (ver el worker). */
export const ANALYSIS_QUALITY = 0.75

export interface QuickAnalysis {
  /** Dimensiones reducidas a 800 px de lado mayor (proporción real de la foto). */
  width: number
  height: number
  /** Miniatura en data URL, o null si no se pudo generar. */
  thumbnail: string | null
  score: PhotoScore
}

/** Misma reducción (y mismo redondeo) que hacía la copia de 800 px. */
export function analysisSize(w: number, h: number): { w: number; h: number } {
  if (w > h && w > ANALYSIS_MAX) return { w: ANALYSIS_MAX, h: Math.round(h * ANALYSIS_MAX / w) }
  if (h > ANALYSIS_MAX) return { w: Math.round(w * ANALYSIS_MAX / h), h: ANALYSIS_MAX }
  return { w, h }
}

/** Misma cuenta que la miniatura de siempre del paso 2. */
export function thumbSize(w: number, h: number): { w: number; h: number } {
  const ratio = w / h
  if (ratio > 1) return { w: THUMB_MAX, h: Math.max(1, Math.round(THUMB_MAX / ratio)) }
  return { w: Math.max(1, Math.round(THUMB_MAX * ratio)), h: THUMB_MAX }
}

/** Muestra que se mide para el puntaje, a partir del tamaño de análisis. */
export function scoreSampleSize(w: number, h: number) {
  const a = analysisSize(w, h)
  return sampleSize(a.w, a.h)
}

export function scoreSample(pixels: Uint8ClampedArray, sw: number, sh: number, w: number, h: number): PhotoScore {
  const a = analysisSize(w, h)
  return scoreFromPixels(pixels, sw, sh, a.w, a.h)
}
