'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getBookFromLocal } from '../../../core/engine/localBookStorage'
import PixiaViewer from '../../../core/modules/viewer/PixiaViewer'
import type { AlbumBlueprint } from '../../../core/contracts/AlbumBlueprint'

// Normalize old PixiaBook format → AlbumBlueprint
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBook(raw: any): AlbumBlueprint {
  // Already new format
  if (raw.spreads && raw.cover && raw.occasion) return raw as AlbumBlueprint

  // Old PixiaBook format: content.spreads with photos[].src (not url)
  const oldSpreads = raw.content?.spreads ?? []

  const spreads = oldSpreads.map((s: any, i: number) => ({
    id: s.id ?? `spread-${i}`,
    act: s.act ?? 'inicio',
    layout: mapOldLayout(s.layout),
    isLocked: false,
    pageNumber: i * 2 + 1,
    caption: s.caption,
    photos: (s.photos ?? []).map((p: any) => ({
      id: p.id,
      url: p.src ?? p.url ?? '',
      thumbnailUrl: p.src ?? p.url ?? '',
      r2Key: '',
      width: 0,
      height: 0,
      orientation: 'landscape' as const,
      originalName: p.id,
      score: {
        sharpness: 0, exposure: 0, composition: 0, faces: 0,
        resolution: 0, uniqueness: 100, emotionalWeight: 50,
        finalScore: 50, recommendation: 'supporting' as const,
      },
    })),
  }))

  const title = raw.identity?.title ?? 'Mi álbum'
  const coverPhotoId = spreads[0]?.photos[0]?.id ?? ''

  return {
    id: raw.identity?.bookId ?? `book-${Date.now()}`,
    sessionId: raw.identity?.bookId ?? '',
    createdAt: new Date(raw.identity?.createdAt ?? Date.now()),
    updatedAt: new Date(),
    version: 1,
    format: '30x30',
    style: 'con-margen',
    occasion: 'boda',
    pageCount: spreads.length * 2,
    cover: { photoId: coverPhotoId, title, style: 'classic' },
    spreads,
    narrative: {
      title,
      summary: raw.editorial?.summary ?? '',
      tone: raw.editorial?.tone ?? '',
    },
    status: 'preview',
    aiGenerated: raw.provenance?.source?.includes('ai') ?? false,
  }
}

function mapOldLayout(layout: string): AlbumBlueprint['spreads'][number]['layout'] {
  switch (layout) {
    case 'full-bleed': return 'full'
    case 'split-horizontal': return 'duo-v'
    case 'editorial-right': return 'hero-2'
    default: return 'full'
  }
}

export default function BookPage() {
  const params = useParams()
  const router = useRouter()
  const [book, setBook] = useState<AlbumBlueprint | null>(null)

  useEffect(() => {
    const loaded = getBookFromLocal(params.id as string)

    if (!loaded) {
      router.replace('/')
      return
    }

    setBook(normalizeBook(loaded))
  }, [params.id, router])

  if (!book) return <p style={{ color: 'white', padding: 32 }}>Cargando...</p>

  return (
    <main>
      <PixiaViewer book={book} />
    </main>
  )
}
