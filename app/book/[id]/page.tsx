'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getBookFromLocal } from '../../../core/engine/localBookStorage'
import { createProposal } from '../../../core/engine/createProposal'
import { PixiaBook } from '../../../core/domain/PixiaBook'
import BookViewer from '../../../components/book/BookViewer'
import { EditIntent } from '../../../core/domain/PixiaEditSession'

export default function BookPage() {
  const params = useParams()
  const router = useRouter()
  const [book, setBook] = useState<PixiaBook | null>(null)

  useEffect(() => {
    const loaded = getBookFromLocal(params.id as string)

    if (!loaded) {
      router.replace('/')
      return
    }

    setBook(loaded)
  }, [params.id, router])

  const handleIntent = (intent: EditIntent) => {
    if (!book) return
    const { previewBook } = createProposal(book, intent)
    setBook(previewBook)
  }

  if (!book) return <p>Cargando...</p>

  return (
    <main>
      <BookViewer
        book={book}
        onEmphasize={(photoId) => handleIntent({ type: 'EMPHASIZE_PHOTO', photoId })}
        onReduceImpact={(photoId) => handleIntent({ type: 'REDUCE_IMPACT', photoId })}
      />
    </main>
  )
}
