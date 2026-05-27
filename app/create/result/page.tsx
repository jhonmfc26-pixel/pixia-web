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

        if (state.photos.length > 20) {
          console.warn('[Pixia] Fotos limitadas a 20 por localStorage')
        }
        const maxPhotos = state.photos.slice(0, 20)
        const photos = await Promise.all(
          maxPhotos.map(async (p) => ({
            id: crypto.randomUUID(),
            src: await fileToCompressedBase64(p.file),
          }))
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
