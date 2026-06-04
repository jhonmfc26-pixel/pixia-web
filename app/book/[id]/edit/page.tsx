'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { AlbumBlueprint, CoverConfig } from '@/core/contracts/AlbumBlueprint'
import type { LayoutConfig, PhotoPlacement } from '@/core/modules/album/types'
import EditorView from '@/core/modules/editor/EditorView'
import { normalizeBook } from '@/core/modules/album/normalizeBook'

export default function EditPage() {
  const params = useParams()
  const id = params.id as string
  const [book, setBook] = useState<AlbumBlueprint | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('pixia_books')
    if (!raw) return
    try {
      const books = JSON.parse(raw)
      const b = books[id]
      if (!b) return
      const normalized = normalizeBook(b, id)
      setBook(normalized)
    } catch (err) {
      console.error('[Edit] Error normalizando book:', err)
    }
  }, [id])

  if (!book) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: '#0D0D0D',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.5)',
      }}>
        Cargando...
      </div>
    )
  }

  const handleSave = (changes: {
    layoutConfig: LayoutConfig
    placements: Map<string, PhotoPlacement>
    cover?: CoverConfig
    manualPhotoOrder?: string[]
  }) => {
    const raw = localStorage.getItem('pixia_books')
    if (!raw) return
    try {
      const books = JSON.parse(raw)
      books[id] = {
        ...books[id],
        layoutConfig: Array.from(changes.layoutConfig.entries()),
        placements: Array.from(changes.placements.entries()),
        ...(changes.cover ? { cover: changes.cover } : {}),
        ...(changes.manualPhotoOrder ? { manualPhotoOrder: changes.manualPhotoOrder } : {}),
      }
      localStorage.setItem('pixia_books', JSON.stringify(books))
    } catch (e) {
      console.error('Error guardando book:', e)
    }
  }

  return <EditorView book={book} onSave={handleSave} />
}
