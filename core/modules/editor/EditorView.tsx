'use client'
import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import type { AlbumBlueprint, AlbumStyle, PhotoAsset, CoverConfig } from '@/core/contracts/AlbumBlueprint'
import type { LayoutConfig, Page, PhotoPlacement, PageLayout } from '@/core/modules/album/types'
import { DEFAULT_PLACEMENT } from '@/core/modules/album/types'
import { buildPages, extractPhotoPool } from '@/core/modules/album/pageEngine'
import EditorPhotoFrame from './EditorPhotoFrame'
import EditorPanel from './EditorPanel'
import CoverEditor from '@/core/modules/cover/CoverEditor'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'

interface EditorViewProps {
  book: AlbumBlueprint
  onSave: (changes: {
    layoutConfig: LayoutConfig
    placements: Map<string, PhotoPlacement>
    cover?: CoverConfig
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
  albumStyle: AlbumStyle
}

function EditorSpreadPage({
  page, photosById, placements,
  adjustingPhotoId, onStartAdjust, onEndAdjust,
  onUpdatePlacement, onOpenLayoutPanel,
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
        onOpenLayoutPanel={() => onOpenLayoutPanel(page.id)}
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

  const photoPool = useMemo(() => extractPhotoPool(book.spreads), [book.spreads])
  const photosById = useMemo(() => {
    const map = new Map<string, PhotoAsset>()
    photoPool.forEach(item => map.set(item.photo.id, item.photo))
    return map
  }, [photoPool])

  const heroPhotos = useMemo(() => {
    const heroes = photoPool
      .map(item => item.photo)
      .filter(p => p.score?.recommendation === 'hero')
    return heroes.length > 0 ? heroes.slice(0, 24) : photoPool.map(item => item.photo).slice(0, 24)
  }, [photoPool])

  const [cover, setCover] = useState<CoverConfig>(book.cover)

  const coverPhotoUrl = useMemo(() => {
    const photo = (cover.photoId && photosById.get(cover.photoId))
                  || heroPhotos[0]
                  || photoPool[0]?.photo
    return photo?.url
  }, [cover.photoId, photosById, heroPhotos, photoPool])

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

  const handleDone = () => {
    onSave({ layoutConfig, placements, cover })
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
          heroPhotos={heroPhotos}
          photoUrl={coverPhotoUrl}
          photosById={photosById}
          onUpdate={setCover}
          onClose={() => setCoverEditorOpen(false)}
        />
      )}
    </div>
  )
}
