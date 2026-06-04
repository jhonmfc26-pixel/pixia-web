'use client'

import { useState, useCallback } from 'react'
import { getPhotoCacheEntry, updatePhotoCacheEntry } from './photoCache'

export interface UploadedPhoto {
  photoId: string
  r2Key: string
  url: string
  thumbnailUrl: string
}

export interface UploadProgress {
  total: number
  completed: number
  isUploading: boolean
  failed: string[]
}


export function useUpload(sessionId: string) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    total: 0, completed: 0, isUploading: false, failed: [],
  })
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([])

  const uploadPhotos = useCallback(async (
    files: { file: File; photoId: string; compressedBlob?: Blob }[]
  ): Promise<UploadedPhoto[]> => {
    if (!sessionId) return []

    // PASO 1 — Separar files ya en cache vs nuevos
    const cachedResults: UploadedPhoto[] = []
    const filesToUpload: typeof files = []

    for (const item of files) {
      const hit = getPhotoCacheEntry(item.file)
      if (hit?.r2Key && hit?.url) {
        cachedResults.push({
          photoId: item.photoId,
          r2Key: hit.r2Key,
          url: hit.url,
          thumbnailUrl: hit.url,
        })
        console.log('[Upload] CACHE HIT:', item.file.name, '→', hit.url.slice(0, 60) + '...')
      } else {
        filesToUpload.push(item)
      }
    }

    if (cachedResults.length > 0) {
      console.log(`[Upload] ${cachedResults.length} fotos reusadas desde cache, ${filesToUpload.length} a subir`)
    }

    // PASO 2 — Si todas estaban en cache, retornar directo
    if (filesToUpload.length === 0) {
      setUploadProgress({
        total: files.length,
        completed: files.length,
        isUploading: false,
        failed: [],
      })
      setUploadedPhotos(cachedResults)
      return cachedResults
    }

    // PASO 3 — Subir solo los nuevos
    setUploadProgress({
      total: files.length,
      completed: cachedResults.length,
      isUploading: true,
      failed: [],
    })

    const results: UploadedPhoto[] = [...cachedResults]
    const failed: string[] = []
    const BATCH_SIZE = 2

    for (let i = 0; i < filesToUpload.length; i += BATCH_SIZE) {
      const batch = filesToUpload.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.allSettled(
        batch.map(async ({ file, photoId }) => {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('sessionId', sessionId)
          formData.append('photoId', photoId)
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          })
          if (!res.ok) {
            const errText = await res.text().catch(() => 'unknown')
            throw new Error(`HTTP ${res.status}: ${errText}`)
          }
          const data = await res.json()
          return {
            photoId,
            r2Key: data.key,
            url: data.url,
            thumbnailUrl: data.url,
          } as UploadedPhoto
        })
      )

      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
          updatePhotoCacheEntry(batch[idx].file, {
            r2Key: result.value.r2Key,
            url: result.value.url,
          })
          console.log('[Upload] OK + cached:', batch[idx].photoId, 'size:', batch[idx].file.size)
        } else {
          failed.push(batch[idx].photoId)
          console.error('[Upload] FAIL:', batch[idx].photoId,
            'size:', batch[idx].file.size,
            'error:', result.reason)
        }
      })

      setUploadProgress(prev => ({
        ...prev,
        completed: cachedResults.length + Math.min(i + BATCH_SIZE, filesToUpload.length),
        failed,
      }))
    }

    setUploadedPhotos(results)
    setUploadProgress(prev => ({ ...prev, isUploading: false }))
    return results
  }, [sessionId])

  return { uploadProgress, uploadedPhotos, uploadPhotos }
}
