'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { AlbumBlueprint, CoverConfig } from '@/core/contracts/AlbumBlueprint'
import type { LayoutConfig, PhotoPlacement } from '@/core/modules/album/types'
import EditorView from '@/core/modules/editor/EditorView'

export default function EditPage() {
  const params = useParams()
  const id = params.id as string
  const [book, setBook] = useState<AlbumBlueprint | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('pixia_books')
    if (!raw) return
    try {
      const books = JSON.parse(raw)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = books[id]
      if (!b) return

      const isOldFormat = !!b.content && !b.spreads

      const spreads = isOldFormat
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (b.content?.spreads || []).map((spread: any) => ({
            ...spread,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            photos: (spread.photos || []).map((photo: any) => ({
              ...photo,
              url: photo.url || photo.src || photo.thumbnailUrl || '',
            })),
          }))
        : (b.spreads || [])

      console.log('[Edit] Total spreads encontrados:', spreads.length)
      console.log('[Edit] Primera foto - tamaño src:', spreads[0]?.photos?.[0]?.src?.length || 0)
      console.log('[Edit] Primera foto - primeros 100 chars:', spreads[0]?.photos?.[0]?.src?.slice(0, 100))
      console.log('[Edit] Primer spread keys:', spreads[0] ? Object.keys(spreads[0]) : 'no hay')
      console.log('[Edit] Primer spread completo:', JSON.stringify(spreads[0]))
      console.log('[Edit] Primera foto del primer spread:', JSON.stringify(spreads[0]?.photos?.[0]))

      const rawCover = isOldFormat
        ? (b.content?.cover || b.identity || {})
        : (b.cover || {})

      const occasion = b.occasion || b.identity?.occasion || 'boda'
      const style = b.style || b.identity?.style || 'con-margen'
      const format = b.format || b.identity?.format || '30x30'

      const layoutConfig = Array.isArray(b.layoutConfig)
        ? new Map(b.layoutConfig)
        : new Map()

      const placements = Array.isArray(b.placements)
        ? new Map(b.placements)
        : new Map()

      console.log('[Edit] Book normalizado:', {
        spreads: spreads.length,
        occasion,
        format,
        hasCover: !!(rawCover.photoId || rawCover.title),
      })

      setBook({
        ...b,
        id,   // siempre usa el id del URL param — PixiaBook viejo no tiene b.id
        spreads,
        cover: {
          photoId: rawCover.photoId || '',
          templateId: rawCover.templateId || 'wedding-classic',
          title: rawCover.title || b.narrative?.title || 'Mi álbum',
          subtitle: rawCover.subtitle || '',
          date: rawCover.date || '',
          textPosition: rawCover.textPosition || 'bottom',
          textAlign: rawCover.textAlign || 'center',
          textColor: rawCover.textColor || 'auto',
        },
        occasion,
        style,
        format,
        layoutConfig,
        placements,
        manualPhotoOrder: Array.isArray(b.manualPhotoOrder) ? b.manualPhotoOrder : undefined,
      } as AlbumBlueprint)
    } catch (e) {
      console.error('[Edit] Error:', e)
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
