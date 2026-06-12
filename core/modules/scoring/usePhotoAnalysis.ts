'use client'
import { useState, useCallback } from 'react'
import { readExif, type ExifData } from './exifReader'
import { scorePhoto, type PhotoScore } from './photoScorer'
import { MAX_PHOTOS } from '@/core/modules/upload/limits'

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

    if (files.length > MAX_PHOTOS) {
      console.warn(`[usePhotoAnalysis] Recibidas ${files.length} fotos, limitando a ${MAX_PHOTOS}`)
      files = files.slice(0, MAX_PHOTOS)
    }

    console.log('[Scoring] Iniciando análisis de', files.length, 'fotos')
    setProgress({ total: files.length, completed: 0, isAnalyzing: true, insights: [] })

    const BATCH_SIZE = 3
    const results: AnalyzedPhoto[] = new Array(files.length)

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length))

      const settled = await Promise.allSettled(
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

      settled.forEach((result, batchIdx) => {
        if (result.status === 'rejected') {
          console.warn(
            `[Scoring] Foto omitida (${batch[batchIdx].name}):`,
            result.reason
          )
        }
      })

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
    (a.exif.takenAt ? new Date(a.exif.takenAt).getTime() : 0) -
    (b.exif.takenAt ? new Date(b.exif.takenAt).getTime() : 0)
  )

  return [...withDate, ...withoutDate]
}

async function compressFile(file: File, maxSize: number, quality: number): Promise<string> {
  if (typeof window === 'undefined') return ''
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    let settled = false

    const cleanup = () => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      URL.revokeObjectURL(url)
    }

    const timeoutId = setTimeout(() => {
      if (settled) return
      cleanup()
      reject(new Error(`compress timeout: ${file.name}`))
    }, 10000)

    img.onload = () => {
      try {
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
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        cleanup()
        resolve(dataUrl)
      } catch {
        cleanup()
        reject(new Error(`compress canvas failed: ${file.name}`))
      }
    }

    img.onerror = () => {
      cleanup()
      reject(new Error(`compress failed: ${file.name}`))
    }

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
