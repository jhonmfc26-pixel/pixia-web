'use client'
import { useState, useCallback } from 'react'
import { readExif, type ExifData } from './exifReader'
import { scorePhoto, type PhotoScore } from './photoScorer'

export interface AnalyzedPhoto {
  id: string
  file: File
  src: string
  originalSrc?: string
  width: number
  height: number
  orientation: 'landscape' | 'portrait' | 'square'
  exif: ExifData
  score: PhotoScore
}

export interface AnalysisProgress {
  total: number
  completed: number
  isAnalyzing: boolean
  insights: string[]
}

export function usePhotoAnalysis() {
  const [analyzedPhotos, setAnalyzedPhotos] = useState<AnalyzedPhoto[]>([])
  const [progress, setProgress] = useState<AnalysisProgress>({
    total: 0, completed: 0, isAnalyzing: false, insights: [],
  })

  const analyzePhotos = useCallback(async (files: File[]) => {
    if (typeof window === 'undefined') {
      console.warn('[Scoring] Skipping — no window')
      return []
    }
    console.log('[Scoring] Iniciando análisis de', files.length, 'fotos')
    setProgress({ total: files.length, completed: 0, isAnalyzing: true, insights: [] })

    const BATCH_SIZE = 5
    const results: AnalyzedPhoto[] = new Array(files.length)

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length))

      await Promise.all(
        batch.map(async (file, batchIdx) => {
          const globalIdx = i + batchIdx

          const exif = await readExif(file)
          const src = await compressFile(file, 800, 0.75)
          const dims = await getImageDimensions(src)

          const ratio = dims.width / dims.height
          const orientation: 'landscape' | 'portrait' | 'square' =
            ratio > 1.15 ? 'landscape' :
            ratio < 0.87 ? 'portrait' : 'square'

          const score = await scorePhoto(src)

          results[globalIdx] = {
            id: crypto.randomUUID(),
            file,
            src,
            width: dims.width,
            height: dims.height,
            orientation,
            exif,
            score,
          }
        })
      )

      const completed = Math.min(i + BATCH_SIZE, files.length)
      const insight = generateInsight(results.filter(Boolean) as AnalyzedPhoto[], completed, files.length)
      setProgress(prev => ({
        ...prev,
        completed,
        insights: insight ? [...prev.insights, insight] : prev.insights,
      }))
    }

    const sorted = sortByExif(results.filter(Boolean) as AnalyzedPhoto[])
    setAnalyzedPhotos(sorted)
    setProgress(prev => ({ ...prev, isAnalyzing: false }))

    return sorted
  }, [])

  return { analyzedPhotos, progress, analyzePhotos }
}

function generateInsight(
  photos: AnalyzedPhoto[], current: number, total: number
): string | null {
  if (current === Math.floor(total * 0.25)) {
    const heroes = photos.filter(p => p.score.recommendation === 'hero').length
    if (heroes > 0) return `Encontramos ${heroes} foto${heroes > 1 ? 's' : ''} protagonista${heroes > 1 ? 's' : ''}`
  }
  if (current === Math.floor(total * 0.5)) {
    const withExif = photos.filter(p => p.exif.takenAt).length
    if (withExif > 0) return `Detectamos orden cronológico en ${withExif} fotos`
  }
  if (current === Math.floor(total * 0.75)) {
    const landscapes = photos.filter(p => p.orientation === 'landscape').length
    if (landscapes > 3) return `${landscapes} fotos horizontales perfectas para doble página`
  }
  if (current === total) return `Análisis completo — ${total} fotos listas`
  return null
}

function sortByExif(photos: AnalyzedPhoto[]): AnalyzedPhoto[] {
  const withDate = photos.filter(p => p.exif.takenAt)
  const withoutDate = photos.filter(p => !p.exif.takenAt)

  if (withDate.length < 2) return photos

  withDate.sort((a, b) =>
    (a.exif.takenAt?.getTime() ?? 0) - (b.exif.takenAt?.getTime() ?? 0)
  )

  return [...withDate, ...withoutDate]
}

async function compressFile(file: File, maxSize: number, quality: number): Promise<string> {
  if (typeof window === 'undefined') return ''
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width > height && width > maxSize) {
        height = Math.round(height * maxSize / width)
        width = maxSize
      } else if (height > maxSize) {
        width = Math.round(width * maxSize / height)
        height = maxSize
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')) }
    img.src = url
  })
}

async function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve({ width: img.width, height: img.height })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = src
  })
}
