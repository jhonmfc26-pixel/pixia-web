'use client'
import type { MeaningRegion } from '@/core/contracts/AlbumBlueprint'

/**
 * Incrementar cada vez que cambie la lógica de análisis (readExif, scoring, etc).
 * Invalida automáticamente el caché viejo sin borrar los datos de upload (r2Key/url).
 * v3 — añade detección de caras (meaningRegions) para smart crop.
 */
export const ANALYSIS_VERSION = 3

const CACHE_KEY = 'pixia_photo_cache'

// Campos que pertenecen al análisis — se invalidan con ANALYSIS_VERSION
const ANALYSIS_FIELDS = new Set(['orientation', 'score', 'takenAt', 'gps', 'thumbnail', 'meaningRegions'])

export interface PhotoCacheEntry {
  /** Versión del análisis con que se generaron estos datos. */
  analysisVersion?: number
  // ── Upload (no versionado) ──────────────────────────────────────────────────
  r2Key?: string
  url?: string
  // ── Análisis (versionado) ───────────────────────────────────────────────────
  orientation?: 'landscape' | 'portrait' | 'square'
  score?: {
    sharpness: number; exposure: number; composition: number; faces: number;
    resolution: number; uniqueness: number; emotionalWeight: number;
    finalScore: number; recommendation: 'hero' | 'great' | 'supporting' | 'discard'
  }
  takenAt?: string | null
  gps?: { lat: number; lng: number } | null
  thumbnail?: string
  meaningRegions?: MeaningRegion[]
}

export function fileToKey(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}_${file.type}`
}

export function readPhotoCache(): Record<string, PhotoCacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function getPhotoCacheEntry(file: File): PhotoCacheEntry | null {
  try {
    const cache = readPhotoCache()
    const entry = cache[fileToKey(file)]
    if (!entry) return null

    // Versión correcta: devolver la entrada completa
    if (entry.analysisVersion === ANALYSIS_VERSION) return entry

    // Versión stale: el análisis debe rehacerse, pero conservar datos de upload
    const { r2Key, url } = entry
    if (r2Key || url) return { r2Key, url }
    return null
  } catch {
    return null
  }
}

export function updatePhotoCacheEntry(file: File, partial: Partial<PhotoCacheEntry>) {
  try {
    const cache = readPhotoCache()
    const key = fileToKey(file)
    // Estampar versión solo cuando se escriben datos de análisis
    const writingAnalysis = Object.keys(partial).some(k => ANALYSIS_FIELDS.has(k))
    cache[key] = {
      ...cache[key],
      ...partial,
      ...(writingAnalysis ? { analysisVersion: ANALYSIS_VERSION } : {}),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch (err) {
    console.warn('[PhotoCache] No se pudo guardar:', err)
  }
}

export function hasFullAnalysis(entry: PhotoCacheEntry | null): boolean {
  if (!entry) return false
  return !!(entry.orientation && entry.score)
}

/** Solo para uso en desarrollo. Limpia todo el caché de fotos y sesión. */
export function clearPixiaCache() {
  const keys = [
    'pixia_photo_cache',
    'pixia_photo_analysis',
    'pixia_r2_photos',
    'pixia_books',
  ]
  for (const key of keys) {
    const had = localStorage.getItem(key) !== null
    localStorage.removeItem(key)
    if (had) console.log(`[DevCache] Borrado: ${key}`)
  }
  console.log('[DevCache] Caché limpio.')
}
