'use client'
import { createContext, useContext } from 'react'

/**
 * Qué versión de cada foto se dibuja (2026-11-12):
 *  - 'print' (por defecto): la original grande — la que usa el PDF.
 *  - 'display': la liviana de users/<sesión>/display/ (1800 px) — la usan el
 *    visor y el editor, para pasar páginas sin decodificar fotos de 12 MP.
 *
 * Por defecto es 'print' a propósito: si algún render se olvida del
 * proveedor, sale con la foto buena (más lento), nunca un PDF borroso.
 */
export type PhotoQuality = 'print' | 'display'
export const PhotoQualityContext = createContext<PhotoQuality>('print')

interface PhotoLike { url?: string; thumbnailUrl?: string }

/** Solo cuenta como versión de visor la que de verdad está en display/ (no el base64 de análisis). */
const isDisplayUrl = (u: string | undefined): u is string => !!u && /^https?:\/\//.test(u) && u.includes('/display/')

export function photoSrc(photo: PhotoLike | undefined, quality: PhotoQuality): string | undefined {
  if (!photo) return undefined
  if (quality === 'display' && isDisplayUrl(photo.thumbnailUrl)) return photo.thumbnailUrl
  return photo.url || photo.thumbnailUrl
}

export function usePhotoQuality(): PhotoQuality {
  return useContext(PhotoQualityContext)
}
