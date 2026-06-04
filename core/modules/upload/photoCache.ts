'use client'

const CACHE_KEY = 'pixia_photo_cache'

export interface PhotoCacheEntry {
  r2Key?: string
  url?: string
  orientation?: 'landscape' | 'portrait' | 'square'
  score?: {
    sharpness: number; exposure: number; composition: number; faces: number;
    resolution: number; uniqueness: number; emotionalWeight: number;
    finalScore: number; recommendation: 'hero' | 'great' | 'supporting' | 'discard'
  }
  takenAt?: string | null
  gps?: { lat: number; lng: number } | null
  thumbnail?: string
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
    return cache[fileToKey(file)] || null
  } catch {
    return null
  }
}

export function updatePhotoCacheEntry(file: File, partial: Partial<PhotoCacheEntry>) {
  try {
    const cache = readPhotoCache()
    const key = fileToKey(file)
    cache[key] = { ...cache[key], ...partial }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch (err) {
    console.warn('[PhotoCache] No se pudo guardar:', err)
  }
}

export function hasFullAnalysis(entry: PhotoCacheEntry | null): boolean {
  if (!entry) return false
  return !!(entry.orientation && entry.score)
}
