'use client'

export const runtime = 'edge'

import { useEffect } from 'react'
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

  useEffect(() => {
    if (state.photos.length === 0) return

    async function build() {
      const photos = await Promise.all(
        state.photos.map(async (p) => ({
          id: p.id,
          src: await fileToBase64(p.file),
        }))
      )

      const book = buildPixiaBook({
        title: 'Mi historia Pixia',
        emotion: state.emotion ?? 'neutral',
        photos,
      })

      saveBookToLocal(book)
      router.push(`/book/${book.identity.bookId}`)
    }

    build()
  }, [state.photos, state.emotion, router])

  return <p>Generando tu libro...</p>
}
