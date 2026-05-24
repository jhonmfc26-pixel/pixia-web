'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildPixiaBook } from '../../../core/engine/buildPixiaBook'
import { saveBookToLocal } from '../../../core/engine/localBookStorage'
import { useWizard } from '../../../components/create/WizardProvider'

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
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
            id: p.id,
            src: await fileToBase64(p.file),
          }))
        )
        console.log('[Pixia] Fotos convertidas a base64', { count: photos.length })

        const book = buildPixiaBook({
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
