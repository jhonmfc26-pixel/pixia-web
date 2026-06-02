'use client'

export const runtime = 'edge'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getBookFromLocal } from '../../../core/engine/localBookStorage'
import PixiaViewer from '../../../core/modules/viewer/PixiaViewer'
import type { AlbumBlueprint } from '../../../core/contracts/AlbumBlueprint'
import { getDefaultTemplate } from '../../../core/modules/cover/coverTemplates'
import { extractPhotoPool, buildPages } from '../../../core/modules/album/pageEngine'
import type { LayoutConfig, PhotoPlacement } from '../../../core/modules/album/types'

// Normalize old PixiaBook format → AlbumBlueprint
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBook(raw: any): AlbumBlueprint {
  // Already new AlbumBlueprint format — patch cover + hydrate Maps
  if (raw.spreads && raw.cover && raw.occasion) {
    const occasion = raw.occasion || 'boda'
    const defaultTemplate = getDefaultTemplate(occasion)
    const cover = raw.cover
    const normalized: AlbumBlueprint = {
      ...raw,
      cover: {
        photoId: cover.photoId || '',
        templateId: cover.templateId || defaultTemplate.id,
        title: cover.title || raw.narrative?.title || 'Mi álbum',
        subtitle: cover.subtitle || '',
        date: cover.date || '',
        textPosition: cover.textPosition || defaultTemplate.defaultPosition,
        textAlign: cover.textAlign || defaultTemplate.defaultAlign,
        textColor: cover.textColor || 'auto',
      },
      // Hidratar Maps desde entries serializadas por el editor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      layoutConfig: Array.isArray(raw.layoutConfig) ? new Map(raw.layoutConfig as any) : new Map(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      placements: Array.isArray(raw.placements) ? new Map(raw.placements as any) : new Map(),
    } as AlbumBlueprint
    return normalized
  }

  // Old PixiaBook format: content.spreads with photos[].src (not url)
  const oldSpreads = raw.content?.spreads ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spreads = oldSpreads.map((s: any, i: number) => ({
    id: s.id ?? `spread-${i}`,
    act: s.act ?? 'inicio',
    layout: mapOldLayout(s.layout),
    isLocked: false,
    pageNumber: i * 2 + 1,
    caption: s.caption,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    photos: (s.photos ?? []).map((p: any) => ({
      id: p.id,
      url: p.src ?? p.url ?? '',
      thumbnailUrl: p.src ?? p.url ?? '',
      r2Key: '',
      width: 0,
      height: 0,
      orientation: (p.orientation ?? 'landscape') as 'landscape' | 'portrait' | 'square',
      originalName: p.originalName ?? p.id,
      score: {
        sharpness: 0, exposure: 0, composition: 0, faces: 0,
        resolution: 0, uniqueness: 100, emotionalWeight: 50,
        finalScore: 50, recommendation: 'supporting' as const,
      },
    })),
  }))

  const occasion = raw.occasion || 'boda'
  const defaultTemplate = getDefaultTemplate(occasion)
  const title = raw.identity?.title ?? 'Mi álbum'
  const coverPhotoId = spreads[0]?.photos[0]?.id ?? ''

  const result = {
    id: raw.identity?.bookId ?? `book-${Date.now()}`,
    sessionId: raw.identity?.bookId ?? '',
    createdAt: new Date(raw.identity?.createdAt ?? Date.now()),
    updatedAt: new Date(),
    version: 1,
    format: '30x30',
    style: 'con-margen',
    occasion,
    pageCount: spreads.length * 2,
    cover: {
      photoId: raw.cover?.photoId || coverPhotoId,
      templateId: raw.cover?.templateId || defaultTemplate.id,
      title: raw.narrative?.title || raw.cover?.title || title,
      subtitle: raw.cover?.subtitle && raw.cover.subtitle !== (raw.narrative?.title || raw.identity?.title)
        ? raw.cover.subtitle
        : '',
      date: raw.cover?.date || '',
      textPosition: raw.cover?.textPosition || defaultTemplate.defaultPosition,
      textAlign: raw.cover?.textAlign || defaultTemplate.defaultAlign,
      textColor: raw.cover?.textColor || 'auto',
    },
    spreads,
    narrative: {
      title,
      summary: raw.editorial?.summary ?? '',
      tone: raw.editorial?.tone ?? '',
    },
    status: 'preview',
    aiGenerated: raw.provenance?.source?.includes('ai') ?? false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layoutConfig: Array.isArray(raw.layoutConfig) ? new Map(raw.layoutConfig as any) : new Map(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    placements: Array.isArray(raw.placements) ? new Map(raw.placements as any) : new Map(),
  } as AlbumBlueprint

  return result
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
  const searchParams = useSearchParams()
  const pageParam = parseInt(searchParams.get('page') || '0', 10)
  const [book, setBook] = useState<AlbumBlueprint | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const loaded = getBookFromLocal(params.id as string)
    if (!loaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotFound(true)
      return
    }
    const normalized = normalizeBook(loaded)
    setBook(normalized)
  }, [params.id])

  useEffect(() => {
    if (notFound) router.replace('/')
  }, [notFound, router])

  const photoPool = useMemo(() => book ? extractPhotoPool(book.spreads) : [], [book])

  const photosById = useMemo(() => {
    const map = new Map()
    photoPool.forEach(item => map.set(item.photo.id, item.photo))
    return map
  }, [photoPool])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookAny = book as any
  const layoutConfig: LayoutConfig = useMemo(() =>
    bookAny?.layoutConfig instanceof Map ? bookAny.layoutConfig : new Map(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book]
  )
  const placements: Map<string, PhotoPlacement> = useMemo(() =>
    bookAny?.placements instanceof Map ? bookAny.placements : new Map(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book]
  )

  const albumPages = useMemo(() => buildPages(photoPool, layoutConfig), [photoPool, layoutConfig])

  const coverPhoto = useMemo(
    () => book ? (photosById.get(book.cover.photoId) ?? photoPool[0]?.photo) : undefined,
    [book, photosById, photoPool]
  )

  if (!book) return <p style={{ color: 'white', padding: 32 }}>Cargando...</p>

  return (
    <main>
      <PixiaViewer
        pages={albumPages.pages}
        photosById={photosById}
        placements={placements}
        coverPhoto={coverPhoto}
        cover={book.cover}
        style={book.style || 'con-margen'}
        format={book.format || '30x30'}
        title={book.cover.title || book.narrative?.title || 'Mi álbum'}
        startPage={Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 0}
        onEdit={(currentPage) => router.push(`/book/${book.id}/edit?page=${currentPage}`)}
      />
    </main>
  )
}
