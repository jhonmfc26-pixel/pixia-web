'use client'
import { useState, useCallback } from 'react'

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

    setUploadProgress({
      total: files.length, completed: 0, isUploading: true, failed: [],
    })

    const results: UploadedPhoto[] = []
    const failed: string[] = []

    const BATCH_SIZE = 2
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)

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
          console.log('[Upload] OK:', batch[idx].photoId, 'size:', batch[idx].file.size)
        } else {
          failed.push(batch[idx].photoId)
          console.error('[Upload] FAIL:', batch[idx].photoId,
            'size:', batch[idx].file.size,
            'error:', result.reason)
        }
      })

      setUploadProgress(prev => ({
        ...prev,
        completed: Math.min(i + BATCH_SIZE, files.length),
        failed,
      }))
    }

    setUploadedPhotos(results)
    setUploadProgress(prev => ({ ...prev, isUploading: false }))
    return results
  }, [sessionId])

  return { uploadProgress, uploadedPhotos, uploadPhotos }
}
