'use client'

export const runtime = 'edge'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getBookFromLocal } from '../../../core/engine/localBookStorage'
import PixiaViewer from '../../../core/modules/viewer/PixiaViewer'
import type { AlbumBlueprint } from '../../../core/contracts/AlbumBlueprint'
import { normalizeBook } from '../../../core/modules/album/normalizeBook'
import { extractPhotoPool, buildPages } from '../../../core/modules/album/pageEngine'
import type { LayoutConfig, PhotoPlacement } from '../../../core/modules/album/types'
import { generatePdfFromBook, downloadPdf } from '../../../core/modules/pdf/generatePdf'

export default function BookPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pageParam = parseInt(searchParams.get('page') || '0', 10)
  const [book, setBook] = useState<AlbumBlueprint | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfHasFailures, setPdfHasFailures] = useState(false)

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

  const photoPool = useMemo(() => {
    if (!book) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manualOrder = (book as any).manualPhotoOrder as string[] | undefined
    return extractPhotoPool(book.spreads, manualOrder)
  }, [book])

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

  const handleDownloadPdf = async () => {
    if (!book) return
    setPdfLoading(true)
    setPdfHasFailures(false)
    try {
      const { bytes, failedPhotos } = await generatePdfFromBook({ book, photosById, layoutConfig, placements })
      downloadPdf(bytes, `${book.cover?.title || 'pixia-album'}.pdf`)
      if (failedPhotos > 0) {
        setPdfHasFailures(true)
        alert(`⚠️ ${failedPhotos} foto${failedPhotos > 1 ? 's' : ''} no se pudo${failedPhotos > 1 ? 'ieron' : ''} incluir en el PDF.\nRevisa tu conexión y descarga de nuevo antes de enviar a impresión.`)
      }
    } catch (err) {
      console.error('[PDF] Falló la generación:', err)
      alert('No se pudo generar el PDF. Revisa la consola.')
    } finally {
      setPdfLoading(false)
    }
  }

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
        onDownloadPdf={handleDownloadPdf}
        pdfLoading={pdfLoading}
        onCheckout={() => {
            if (pdfHasFailures) {
              alert('El PDF descargado tiene fotos faltantes. Descárgalo de nuevo para verificarlo antes de enviar a impresión.')
              return
            }
            router.push(`/checkout/${book.id}`)
          }}
      />
    </main>
  )
}
