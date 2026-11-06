'use client'

import { prunePhotoCache } from './photoCache'

/**
 * Datos por foto que el paso 2 deja para los pasos siguientes (portada y
 * generación): análisis (dimensiones, orientación, score, fecha) y la URL en R2.
 *
 * Todo va indexado por el id de la foto en el asistente (PhotoItem.id). Antes
 * se emparejaba por posición: el análisis estaba en orden cronológico y las
 * fotos del asistente en el orden en que se eligieron, así que la portada, las
 * ⭐ y las dimensiones caían en fotos equivocadas. Además cada tanda nueva de
 * fotos borraba el análisis de las anteriores.
 */

const ANALYSIS_KEY = 'pixia_photo_analysis'
const R2_KEY = 'pixia_r2_photos'

export interface PhotoAnalysisEntry {
  id: string
  width: number
  height: number
  orientation: 'landscape' | 'portrait' | 'square'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  score: any
  takenAt: string | null
  gps: { lat: number; lng: number } | null
  thumbnail?: string
  contentHash?: string
}

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function isQuotaError(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)
}

/**
 * setItem que no revienta por falta de espacio: si el navegador está lleno
 * (Safari en iPhone da ~5 MB por sitio) primero libera las miniaturas viejas
 * del caché de fotos y reintenta; si aún no cabe, prueba con `fallback`.
 */
export function setItemSafe(key: string, value: string, fallback?: () => string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    if (!isQuotaError(e)) throw e
  }
  prunePhotoCache()
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    if (!isQuotaError(e)) throw e
  }
  if (fallback) {
    try {
      localStorage.setItem(key, fallback())
      return true
    } catch (e) {
      if (!isQuotaError(e)) throw e
    }
  }
  console.warn(`[photoSession] Sin espacio para guardar ${key}`)
  return false
}

export function readPhotoAnalysis(): Map<string, PhotoAnalysisEntry> {
  return new Map(readList<PhotoAnalysisEntry>(ANALYSIS_KEY).filter(e => e?.id).map(e => [e.id, e]))
}

/** Agrega/actualiza entradas y descarta las de fotos que ya no están en el álbum. */
export function mergePhotoAnalysis(entries: PhotoAnalysisEntry[], keepIds: Set<string>): void {
  const map = readPhotoAnalysis()
  for (const e of entries) map.set(e.id, e)
  const list = [...map.values()].filter(e => keepIds.has(e.id))
  setItemSafe(ANALYSIS_KEY, JSON.stringify(list), () =>
    // Sin espacio: las miniaturas son lo prescindible (la portada usa el archivo).
    JSON.stringify(list.map(({ thumbnail: _t, ...rest }) => rest)),
  )
}

export function readR2Photos(): Map<string, string> {
  return new Map(
    readList<{ photoId: string; url: string }>(R2_KEY)
      .filter(p => p?.photoId && p?.url)
      .map(p => [p.photoId, p.url]),
  )
}

export function mergeR2Photos(uploaded: { photoId: string; url: string }[], keepIds: Set<string>): void {
  const map = readR2Photos()
  for (const u of uploaded) map.set(u.photoId, u.url)
  const list = [...map.entries()].filter(([id]) => keepIds.has(id)).map(([photoId, url]) => ({ photoId, url }))
  setItemSafe(R2_KEY, JSON.stringify(list))
}
