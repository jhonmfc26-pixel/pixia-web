'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildPixiaBook } from '../../../core/engine/buildPixiaBook'
import { saveBookToLocal } from '../../../core/engine/localBookStorage'
import { useWizard } from '../../../components/create/WizardProvider'

async function fileToCompressedBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      const MAX = 1200
      let { width, height } = img

      if (width > height && width > MAX) {
        height = Math.round((height * MAX) / width)
        width = MAX
      } else if (height > width && height > MAX) {
        width = Math.round((width * MAX) / height)
        height = MAX
      } else if (width > MAX) {
        width = MAX
        height = MAX
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas not available'))

      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)

      const compressed = canvas.toDataURL('image/jpeg', 0.82)
      resolve(compressed)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Error cargando imagen'))
    }

    img.src = url
  })
}

export default function ResultPage() {
  const router = useRouter()
  const { state } = useWizard()
  console.log('[Pixia] state.photos al cargar result:', state.photos.length)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (state.photos.length === 0) return

    async function build() {
      try {
        console.log('[Pixia] Iniciando generación', { photoCount: state.photos.length })

        const photos = await Promise.all(
          state.photos.map(async (p) => ({
            id: crypto.randomUUID(),
            src: await fileToCompressedBase64(p.file),
          }))
        )
        console.log('[Pixia] Fotos convertidas a base64', { count: photos.length })

        const book = await buildPixiaBook({
          title: 'Mi historia Pixia',
          emotion: state.emotion ?? 'neutral',
          photos,
        })
        console.log('[Pixia] PixiaBook creado', { bookId: book.identity.bookId, spreads: book.content.spreads.length })

        saveBookToLocal(book)
        console.log('[Pixia] Libro guardado en localStorage')

        console.log('[Pixia] Navegando a', `/book/${book.identity.bookId}`)
        router.push(`/book/${book.identity.bookId}`)
      } catch (err) {
        console.error('[Pixia] ERROR en generación:', err)
        setError(String(err))
      }
    }

    build()
  }, [state.photos, state.emotion, router])

  return (
    <p>
      Generando tu libro...
      {error && (
        <p style={{ color: 'red', fontSize: 12, marginTop: 16, maxWidth: 300, textAlign: 'center' }}>
          {error}
        </p>
      )}
    </p>
  )
}
