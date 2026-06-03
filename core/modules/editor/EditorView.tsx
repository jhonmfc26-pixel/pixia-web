'use client'
import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { AlbumBlueprint, AlbumStyle, PhotoAsset, CoverConfig } from '@/core/contracts/AlbumBlueprint'
import type { LayoutConfig, Page, PhotoPlacement, PageLayout } from '@/core/modules/album/types'
import { DEFAULT_PLACEMENT } from '@/core/modules/album/types'
import { buildPages, extractPhotoPool } from '@/core/modules/album/pageEngine'
import EditorPhotoFrame from './EditorPhotoFrame'
import EditorPanel from './EditorPanel'
import CoverEditor from '@/core/modules/cover/CoverEditor'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'
import PhotoReplaceModal from './PhotoReplaceModal'
import PhotoReorderModal from './PhotoReorderModal'

interface EditorViewProps {
  book: AlbumBlueprint
  onSave: (changes: {
    layoutConfig: LayoutConfig
    placements: Map<string, PhotoPlacement>
    cover?: CoverConfig
    manualPhotoOrder?: string[]
  }) => void
}

interface EditorSpreadPageProps {
  page: Page
  photosById: Map<string, PhotoAsset>
  placements: Map<string, PhotoPlacement>
  adjustingPhotoId: string | null
  onStartAdjust: (photoId: string) => void
  onEndAdjust: () => void
  onUpdatePlacement: (photoId: string, placement: PhotoPlacement) => void
  onOpenLayoutPanel: (pageId: string) => void
  onReplacePhoto: (photoId: string) => void
  onDeletePhoto: (photoId: string) => void
  albumStyle: AlbumStyle
}

function EditorSpreadPage({
  page, photosById, placements,
  adjustingPhotoId, onStartAdjust, onEndAdjust,
  onUpdatePlacement, onOpenLayoutPanel, onReplacePhoto, onDeletePhoto,
}: EditorSpreadPageProps) {
  const photoIds = page.photoIds

  const frameFor = (id: string) => {
    const photo = photosById.get(id)
    if (!photo) return null
    return (
      <EditorPhotoFrame
        key={id}
        photo={photo}
        placement={placements.get(id) ?? DEFAULT_PLACEMENT}
        isAdjusting={id === adjustingPhotoId}
        onStartAdjust={() => onStartAdjust(id)}
        onEndAdjust={onEndAdjust}
        onUpdatePlacement={(p) => onUpdatePlacement(id, p)}
        onReplace={() => onReplacePhoto(id)}
        onDelete={() => onDeletePhoto(id)}
      />
    )
  }

  // CASO ESPECIAL: hero-spread (foto cruza 2 páginas, no es layout genérico)
  if (page.layout === 'hero-spread') {
    const photo = photosById.get(photoIds[0])
    const spreadHalf = page.spreadHalf
    if (!photo || !spreadHalf) return null
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          ...(spreadHalf === 'left' ? { left: 0 } : { right: 0 }),
          width: '200%',
          height: '100%',
        }}>
          <img
            src={photo.url}
            alt=""
            draggable={false}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              display: 'block',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenLayoutPanel(page.id) }}
          style={{
            position: 'absolute', bottom: 12, right: 12,
            background: 'rgba(0,0,0,0.7)', color: 'white',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6, padding: '6px 12px',
            fontSize: 12, cursor: 'pointer', zIndex: 10,
          }}
        >◫ Diseño</button>
      </div>
    )
  }

  // CASO GENÉRICO: cualquier layout del registry con grid
  const schema = getLayoutById(page.layout)
  if (!schema) {
    console.warn('[EditorSpreadPage] Layout no encontrado en registry:', page.layout)
    return null
  }

  const innerPadding = schema.innerPadding ?? '0px'

  return (
    <div style={{
      width: '100%', height: '100%',
      padding: innerPadding,
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: schema.grid.columns,
        gridTemplateRows: schema.grid.rows,
        gridTemplateAreas: schema.grid.areas,
        gap: '2px',
        width: '100%',
        height: '100%',
      }}>
        {schema.slots.map((slot, i) => {
          const id = photoIds[i]
          return (
            <div
              key={slot}
              style={{
                gridArea: slot,
                position: 'relative',
                minWidth: 0,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              {id ? frameFor(id) : null}
            </div>
          )
        })}
      </div>

      {/* Botón Diseño a nivel de página (uno solo, fuera del grid) */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenLayoutPanel(page.id) }}
        style={{
          position: 'absolute', bottom: 12, right: 12,
          background: 'rgba(0,0,0,0.7)', color: 'white',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 6, padding: '6px 12px',
          fontSize: 12, cursor: 'pointer', zIndex: 10,
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.9)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
      >◫ Diseño</button>
    </div>
  )
}

const AVAILABLE_LAYOUTS: PageLayout[] = [
  // Básicos
  'single', 'side-2', 'stack-2', 'portrait',
  // Trío
  'trio-row', 'trio-column', 'trio-portrait',
  // Grids
  'grid-3', 'grid-4', 'quad-mixed',
  // Hero
  'hero-2-bottom', 'hero-3-top', 'hero-3-left', 'hero-3-right',
  // Mosaicos densos
  'mosaic-5', 'hero-4-grid',
  // Especiales
  'portrait-pair', 'hero-spread',
]

export default function EditorView({ book, onSave }: EditorViewProps) {
  const searchParams = useSearchParams()
  const fromPage = parseInt(searchParams.get('page') || '0', 10)
  const initialSpread = fromPage > 0 ? Math.floor((fromPage - 1) / 2) : 0

  const [manualPhotoOrder, setManualPhotoOrder] = useState<string[] | undefined>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (book as any).manualPhotoOrder
  )

  const photoPool = useMemo(
    () => extractPhotoPool(book.spreads, manualPhotoOrder),
    [book.spreads, manualPhotoOrder]
  )
  const photosById = useMemo(() => {
    const map = new Map<string, PhotoAsset>()
    photoPool.forEach(item => map.set(item.photo.id, item.photo))
    return map
  }, [photoPool])

  const coverPhotoOptions = useMemo(
    () => photoPool.map(item => item.photo),
    [photoPool]
  )

  const [cover, setCover] = useState<CoverConfig>(book.cover)

  const coverPhotoUrl = useMemo(() => {
    const photo = (cover.photoId && photosById.get(cover.photoId))
                  || coverPhotoOptions[0]
                  || photoPool[0]?.photo
    return photo?.url
  }, [cover.photoId, photosById, coverPhotoOptions, photoPool])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookAny = book as any
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(
    bookAny.layoutConfig instanceof Map ? bookAny.layoutConfig : new Map()
  )
  const [placements, setPlacements] = useState<Map<string, PhotoPlacement>>(
    bookAny.placements instanceof Map ? bookAny.placements : new Map()
  )
  const [currentSpread, setCurrentSpread] = useState(initialSpread)
  const [adjustingPhotoId, setAdjustingPhotoId] = useState<string | null>(null)
  const [layoutPanelOpen, setLayoutPanelOpen] = useState<string | null>(null)
  const [coverEditorOpen, setCoverEditorOpen] = useState(false)
  const [replacePhotoOpen, setReplacePhotoOpen] = useState<string | null>(null)
  const [reorderOpen, setReorderOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const albumPages = useMemo(
    () => buildPages(photoPool, layoutConfig),
    [photoPool, layoutConfig]
  )

  const spreads = useMemo(() => {
    const result: Array<{ left: Page | null; right: Page | null; index: number }> = []
    for (let i = 0; i < albumPages.pages.length; i += 2) {
      result.push({
        left: albumPages.pages[i] ?? null,
        right: albumPages.pages[i + 1] ?? null,
        index: i / 2,
      })
    }
    return result
  }, [albumPages.pages])

  const totalSpreads = spreads.length
  const spread = spreads[currentSpread]

  const handleUpdatePlacement = (photoId: string, placement: PhotoPlacement) => {
    const clamped: PhotoPlacement = {
      zoom: Math.max(1, Math.min(3, placement.zoom)),
      offsetX: Math.max(-50, Math.min(50, placement.offsetX)),
      offsetY: Math.max(-50, Math.min(50, placement.offsetY)),
    }
    setPlacements(prev => {
      const next = new Map(prev)
      next.set(photoId, clamped)
      return next
    })
  }

  const handleChangeLayout = (pageId: string, newLayout: PageLayout) => {
    const pageIndex = albumPages.pages.findIndex(p => p.id === pageId)
    if (pageIndex === -1) return
    setLayoutConfig(prev => {
      const next = new Map(prev)
      next.set(pageIndex, newLayout)
      return next
    })
    setLayoutPanelOpen(null)
  }

  const currentOrder = useMemo(
    () => photoPool.map(item => item.photo.id),
    [photoPool]
  )

  const replaceCandidates = useMemo((): PhotoAsset[] => {
    if (!replacePhotoOpen) return []
    const currentPhoto = photosById.get(replacePhotoOpen)
    if (!currentPhoto) return []

    const pages = albumPages.pages
    const targetPageIdx = pages.findIndex(p => p.photoIds?.includes(replacePhotoOpen))
    const targetSpreadIdx = targetPageIdx >= 0 ? Math.floor(targetPageIdx / 2) : -1

    const photosInCurrentSpread = new Set<string>()
    if (targetSpreadIdx >= 0) {
      const leftIdx = targetSpreadIdx * 2
      pages[leftIdx]?.photoIds?.forEach((id: string) => photosInCurrentSpread.add(id))
      pages[leftIdx + 1]?.photoIds?.forEach((id: string) => photosInCurrentSpread.add(id))
    }
    photosInCurrentSpread.add(replacePhotoOpen)

    const available = photoPool
      .map(item => item.photo)
      .filter(p => !photosInCurrentSpread.has(p.id))

    const targetOrientation = currentPhoto.orientation
    const sameOrientation = available.filter(p => p.orientation === targetOrientation)
    const filtered = sameOrientation.length >= 3 ? sameOrientation : available

    const sorted = [...filtered].sort(
      (a, b) => (b.score?.finalScore ?? 0) - (a.score?.finalScore ?? 0)
    )

    return sorted.slice(0, 6)
  }, [replacePhotoOpen, photosById, photoPool, albumPages])

  const handleReplacePhoto = (oldPhotoId: string, newPhotoId: string) => {
    const newOrder = [...currentOrder]
    const oldIdx = newOrder.indexOf(oldPhotoId)
    const newIdx = newOrder.indexOf(newPhotoId)
    if (oldIdx < 0 || newIdx < 0) return
    ;[newOrder[oldIdx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[oldIdx]]
    setManualPhotoOrder(newOrder)
    setReplacePhotoOpen(null)
  }

  const handleRequestDelete = useCallback((photoId: string) => {
    setConfirmDeleteId(photoId)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    const photoId = confirmDeleteId
    if (!photoId) return
    setManualPhotoOrder(prev => {
      const base = prev ?? currentOrder
      return base.filter(id => id !== photoId)
    })
    setPlacements(prev => {
      const next = new Map(prev)
      next.delete(photoId)
      return next
    })
    if (cover.photoId === photoId) {
      setCover(prev => ({ ...prev, photoId: '' }))
    }
    setConfirmDeleteId(null)
  }, [confirmDeleteId, currentOrder, cover.photoId])

  const handleDone = () => {
    onSave({ layoutConfig, placements, cover, manualPhotoOrder })
    const targetPage = currentSpread * 2 + 1
    window.location.href = `/book/${book.id}?page=${targetPage}`
  }

  const layoutPanelPage = layoutPanelOpen
    ? albumPages.pages.find(p => p.id === layoutPanelOpen) ?? null
    : null

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0D0D0D',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* Barra superior */}
      <div style={{
        height: '56px', flexShrink: 0,
        background: 'rgba(10,10,10,0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 24px',
      }}>
        <button
          onClick={() => { window.location.href = `/book/${book.id}?page=${fromPage}` }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px' }}
        >
          ← Cancelar
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: 'white' }}>
            Editando · Páginas {currentSpread * 2 + 1}-{currentSpread * 2 + 2} de {totalSpreads * 2}
          </span>
          <button
            onClick={() => setReorderOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px',
              padding: '6px 14px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Reordenar fotos
          </button>
          <button
            onClick={() => setCoverEditorOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px',
              padding: '6px 14px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Editar portada
          </button>
        </div>

        <button
          onClick={handleDone}
          style={{
            background: '#E8553A', border: 'none', borderRadius: '6px',
            padding: '8px 18px', color: 'white', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
          }}
        >
          ✓ Listo
        </button>
      </div>

      {/* Spread central */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', gap: '4px', overflow: 'hidden',
      }}>
        {spread && (
          <>
            <div style={{
              width: 'min(42vw, 480px)', aspectRatio: '1',
              background: '#0f0f0f', boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              position: 'relative', flexShrink: 0,
            }}>
              {spread.left && (
                <EditorSpreadPage
                  page={spread.left}
                  photosById={photosById}
                  placements={placements}
                  adjustingPhotoId={adjustingPhotoId}
                  onStartAdjust={setAdjustingPhotoId}
                  onEndAdjust={() => setAdjustingPhotoId(null)}
                  onUpdatePlacement={handleUpdatePlacement}
                  onOpenLayoutPanel={(id) => setLayoutPanelOpen(id)}
                  onReplacePhoto={(photoId) => setReplacePhotoOpen(photoId)}
                  onDeletePhoto={handleRequestDelete}
                  albumStyle={book.style || 'con-margen'}
                />
              )}
            </div>

            <div style={{
              width: 'min(42vw, 480px)', aspectRatio: '1',
              background: '#0f0f0f', boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              position: 'relative', flexShrink: 0,
            }}>
              {spread.right && (
                <EditorSpreadPage
                  page={spread.right}
                  photosById={photosById}
                  placements={placements}
                  adjustingPhotoId={adjustingPhotoId}
                  onStartAdjust={setAdjustingPhotoId}
                  onEndAdjust={() => setAdjustingPhotoId(null)}
                  onUpdatePlacement={handleUpdatePlacement}
                  onOpenLayoutPanel={(id) => setLayoutPanelOpen(id)}
                  onReplacePhoto={(photoId) => setReplacePhotoOpen(photoId)}
                  onDeletePhoto={handleRequestDelete}
                  albumStyle={book.style || 'con-margen'}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Barra inferior — navegación entre spreads */}
      <div style={{
        height: '64px', flexShrink: 0,
        background: 'rgba(10,10,10,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
      }}>
        <button
          onClick={() => setCurrentSpread(s => Math.max(0, s - 1))}
          disabled={currentSpread === 0}
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'white', fontSize: '18px',
            cursor: currentSpread === 0 ? 'default' : 'pointer',
            opacity: currentSpread === 0 ? 0.3 : 1,
          }}
        >‹</button>

        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', minWidth: '80px', textAlign: 'center' }}>
          {currentSpread + 1} / {totalSpreads}
        </span>

        <button
          onClick={() => setCurrentSpread(s => Math.min(totalSpreads - 1, s + 1))}
          disabled={currentSpread >= totalSpreads - 1}
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'white', fontSize: '18px',
            cursor: currentSpread >= totalSpreads - 1 ? 'default' : 'pointer',
            opacity: currentSpread >= totalSpreads - 1 ? 0.3 : 1,
          }}
        >›</button>
      </div>

      {/* Panel de layouts */}
      {layoutPanelPage && (
        <EditorPanel
          availableLayouts={AVAILABLE_LAYOUTS}
          currentLayout={layoutPanelPage.layout}
          selectedPageIndex={albumPages.pages.findIndex(p => p.id === layoutPanelOpen) + 1}
          totalPages={albumPages.pages.length}
          onChangeLayout={(layout) => handleChangeLayout(layoutPanelOpen!, layout)}
          onClose={() => setLayoutPanelOpen(null)}
        />
      )}

      {coverEditorOpen && (
        <CoverEditor
          config={cover}
          occasion={book.occasion}
          format={book.format || '30x30'}
          heroPhotos={coverPhotoOptions}
          photoUrl={coverPhotoUrl}
          photosById={photosById}
          onUpdate={setCover}
          onClose={() => setCoverEditorOpen(false)}
        />
      )}

      {reorderOpen && (
        <PhotoReorderModal
          photoIds={currentOrder}
          photosById={photosById}
          onSave={(newOrder) => setManualPhotoOrder(newOrder)}
          onClose={() => setReorderOpen(false)}
        />
      )}

      {confirmDeleteId && (
        <div
          onClick={() => setConfirmDeleteId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 600,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#161616',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '380px',
              width: '90%',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', color: 'white', marginBottom: '8px' }}>
              Eliminar esta foto?
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '20px', lineHeight: 1.5 }}>
              La foto se quitará del álbum y las páginas se rearmarán automáticamente.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setConfirmDeleteId(null)}
                style={{
                  flex: 1, padding: '10px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '13px', cursor: 'pointer',
                }}
              >Cancelar</button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  flex: 1, padding: '10px',
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '13px', fontWeight: 500,
                  cursor: 'pointer',
                }}
              >Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {replacePhotoOpen && (() => {
        const currentPhoto = photosById.get(replacePhotoOpen)
        if (!currentPhoto) return null
        return (
          <PhotoReplaceModal
            currentPhoto={currentPhoto}
            candidates={replaceCandidates}
            onPick={(newPhoto) => handleReplacePhoto(replacePhotoOpen, newPhoto.id)}
            onClose={() => setReplacePhotoOpen(null)}
          />
        )
      })()}
    </div>
  )
}
