'use client'

export const runtime = 'edge'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildPixiaBookWithAI } from '../../../core/engine/buildPixiaBook'
import { saveBookToLocal } from '../../../core/engine/localBookStorage'
import { useWizard } from '../../../components/create/WizardProvider'

async function fileToCompressedBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      const MAX = 800
      let { width, height } = img

      if (width > height && width > MAX) {
        height = Math.round((height * MAX) / width)
        width = MAX
      } else if (height > MAX) {
        width = Math.round((width * MAX) / height)
        height = MAX
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)

      resolve(canvas.toDataURL('image/jpeg', 0.70))
    }

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Error cargando imagen')) }

    img.src = url
  })
}

export default function ResultPage() {
  const router = useRouter()
  const { state } = useWizard()
  console.log('[Pixia] state.photos al cargar result:', state.photos.length)
  const [error, setError] = useState<string | null>(null)
  const hasGenerated = useRef(false)

  useEffect(() => {
    if (hasGenerated.current) return
    if (state.photos.length === 0) return
    hasGenerated.current = true

    async function build() {
      try {
        console.log('[Pixia] Iniciando generación con AI', { photoCount: state.photos.length })

        // Leer análisis EXIF/score del wizard
        const analysisRaw = localStorage.getItem('pixia_photo_analysis')
        const analysis: any[] = analysisRaw ? JSON.parse(analysisRaw) : []
        console.log('[Result] analysis del localStorage:', analysis.length, 'fotos')
        console.log('[Result] primera foto takenAt:', analysis[0]?.takenAt)

        // Ordenar el análisis por takenAt
        const sortedAnalysis = [...analysis].sort((a, b) => {
          if (!a.takenAt && !b.takenAt) return 0
          if (!a.takenAt) return 1
          if (!b.takenAt) return -1
          return new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime()
        })

        // Leer URLs de R2 si ya fueron subidas
        const r2Raw = localStorage.getItem('pixia_r2_photos')
        const r2Photos: any[] = r2Raw ? JSON.parse(r2Raw) : []
        const r2Map = new Map(r2Photos.map((p: any) => [p.photoId, p.url]))
        console.log('[Result] Fotos en R2:', r2Photos.length)

        // Reordenar state.photos según el orden cronológico del análisis
        const filesToProcess = sortedAnalysis.length === state.photos.length
          ? sortedAnalysis.map((a: any) => state.photos[a.originalIndex])
          : state.photos.slice(0, 60)

        console.log('[Result] Orden de archivos:',
          sortedAnalysis.map((a: any) => `${a.originalIndex}→${a.takenAt || 'sin-fecha'}`)
        )

        console.log('[Result] IDs únicos en análisis:',
          new Set(analysis.map((a: any) => a.id)).size, 'de', analysis.length
        )

        const photos = await Promise.all(
          filesToProcess.slice(0, 60).map(async (p: any, index: number) => {
            const meta = sortedAnalysis[index]
            const r2Url = meta?.id ? r2Map.get(meta.id) : null
            const src = r2Url || await fileToCompressedBase64(p.file)
            return {
              id: meta?.id || `photo-${index}`,
              src,
              url: src,
              thumbnailUrl: meta?.thumbnail || '',
              r2Key: '',
              width: 0,
              height: 0,
              takenAt: meta?.takenAt || null,
              orientation: (meta?.orientation || 'landscape') as 'landscape' | 'portrait' | 'square',
              score: meta?.score || null,
              originalName: p.file?.name || `photo-${index}`,
            }
          })
        )

        console.log('[Result] Fotos con R2 URL:', photos.filter((p: any) => p.url?.startsWith('http')).length)
        console.log('[Result] orden después de sort:',
          photos.map((p: any) => p.takenAt || 'sin-fecha')
        )
        console.log('[Pixia] Fotos convertidas a base64', { count: photos.length })

        const book = await buildPixiaBookWithAI({
          photos,
          story: state.storyType ?? 'general',
          style: state.style ?? 'cinematico',
          emotion: state.emotion ?? 'emocional',
        })
        console.log('[Pixia] PixiaBook creado', { bookId: book.identity.bookId, spreads: book.content.spreads.length, version: book.identity.version })

        saveBookToLocal(book)
        console.log('[Pixia] Libro guardado en localStorage')

        router.push(`/book/${book.identity.bookId}`)
      } catch (err) {
        console.error('[Pixia] ERROR en generación:', err)
        setError(String(err))
      }
    }

    build()
  }, [state.photos, state.storyType, state.style, state.emotion, router])

  return (
    <div>
      Generando tu libro...
      {error && (
        <div style={{ color: 'red', fontSize: 12, marginTop: 16, maxWidth: 300, textAlign: 'center' }}>
          {error}
        </div>
      )}
    </div>
  )
}
