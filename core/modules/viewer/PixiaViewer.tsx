'use client'
import HTMLFlipBook from 'react-pageflip'
import { useState, useRef, useMemo, useEffect } from 'react'
import type { AlbumBlueprint, AlbumStyle, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { LayoutConfig, PageLayout } from '@/core/modules/album/types'
import { buildPages, extractPhotoPool } from '@/core/modules/album/pageEngine'
import PageRenderer from './PageRenderer'
import CoverPage from './pages/CoverPage'
import BackCoverPage from './pages/BackCoverPage'
import BlankPage from './pages/BlankPage'
import EditorPanel from '@/core/modules/editor/EditorPanel'

interface PixiaViewerProps {
  book: AlbumBlueprint
}

export default function PixiaViewer({ book }: PixiaViewerProps) {
  // Pool de fotos ordenado (con acto)
  const photoPool = useMemo(
    () => extractPhotoPool(book.spreads),
    [book.spreads]
  )

  // Mapa de fotos por ID para lookups rápidos
  const photosById = useMemo(() => {
    const map = new Map<string, PhotoAsset>()
    photoPool.forEach(item => map.set(item.photo.id, item.photo))
    return map
  }, [photoPool])

  // Estado del editor
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(new Map())
  const [editMode, setEditMode] = useState(false)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [albumStyle, setAlbumStyle] = useState<AlbumStyle>(book.style || 'con-margen')
  const [currentPage, setCurrentPage] = useState(0)
  const [pageToRestore, setPageToRestore] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [pageSize, setPageSize] = useState(420)
  const bookRef = useRef<any>(null)

  // Construir páginas con el motor
  const albumPages = useMemo(() => {
    console.log('[Viewer] photoPool orientaciones:',
      photoPool.map(p => `${p.photo.id?.slice(0, 8)}: ${p.photo.orientation || 'undefined'}`)
    )
    return buildPages(photoPool, layoutConfig)
  }, [photoPool, layoutConfig])

  // Dimensiones responsive
  useEffect(() => {
    function calc() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) {
        setPageSize(Math.min(window.innerWidth - 32, 340))
      } else {
        const availH = window.innerHeight - 56 - 48 - 32
        setPageSize(Math.min(availH, 480))
      }
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  // Total de páginas (portada + páginas + paridad + contraportada)
  const innerPages  = albumPages.pages.length
  const needsBlank  = innerPages % 2 !== 0
  const totalPages  = 1 + innerPages + (needsBlank ? 1 : 0) + 1

  // Key estable para forzar remontaje cuando cambia la estructura del libro
  const flipbookKey = useMemo(() => {
    return albumPages.pages.map(p =>
      `${p.id}:${p.layout}:${p.photoIds.join(',')}`
    ).join('|') + `:${albumStyle}:${needsBlank}`
  }, [albumPages.pages, albumStyle, needsBlank])

  // Cambiar layout de una página
  const handleChangeLayout = (newLayout: PageLayout) => {
    setPageToRestore(currentPage)
    const pageIndex = albumPages.pages.findIndex(p => p.id === selectedPageId)
    if (pageIndex === -1) return
    setLayoutConfig(prev => {
      const next = new Map(prev)
      next.set(pageIndex, newLayout)
      return next
    })
  }

  // Click en foto (modo edición)
  const handlePhotoClick = (pageId: string, _photoId: string) => {
    setSelectedPageId(pageId)
  }

  const selectedPage      = albumPages.pages.find(p => p.id === selectedPageId)
  const selectedPageIndex = albumPages.pages.findIndex(p => p.id === selectedPageId)

  // Layouts disponibles según fotos restantes
  const availableLayouts: PageLayout[] = useMemo(() => {
    return ['single', 'stack-2', 'side-2', 'grid-3', 'grid-4', 'portrait', 'cross-left']
  }, [])

  // Portada
  const coverPhoto = photoPool[0]?.photo

  // Hijos del flipbook — array limpio sin nulls
  const flipChildren = [
    <div key="cover" style={{ width: '100%', height: '100%' }}>
      <CoverPage
        photo={coverPhoto}
        cover={book.cover || { photoId: '', title: book.narrative?.title || 'Mi álbum', style: 'classic' as const }}
        style={albumStyle}
      />
    </div>,

    ...albumPages.pages.map(page => (
      <div key={page.id} style={{ width: '100%', height: '100%' }}>
        <PageRenderer
          page={page}
          photosById={photosById}
          style={albumStyle}
          isEditMode={editMode}
          isSelected={page.id === selectedPageId}
          onPhotoClick={handlePhotoClick}
        />
      </div>
    )),

    ...(needsBlank ? [
      <div key="blank" style={{ width: '100%', height: '100%' }}>
        <BlankPage style={albumStyle} />
      </div>,
    ] : []),

    <div key="back" style={{ width: '100%', height: '100%' }}>
      <BackCoverPage style={albumStyle} />
    </div>,
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0D0D0D',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* Barra superior */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        background: 'rgba(10,10,10,0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 24px',
        zIndex: 300,
      }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px' }}
        >
          ← Volver
        </button>

        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', color: 'white' }}>
          {book.narrative?.title || book.cover?.title || 'Mi álbum'}
        </span>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Toggle margen */}
          <button
            onClick={() => setAlbumStyle(albumStyle === 'con-margen' ? 'sin-margen' : 'con-margen')}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}
          >
            {albumStyle === 'con-margen' ? 'Con margen' : 'Sin margen'}
          </button>

          {/* Botón editar */}
          <button
            onClick={() => { setEditMode(prev => !prev); setSelectedPageId(null) }}
            style={{
              fontSize: '12px', padding: '6px 14px', borderRadius: '6px',
              border: '1px solid',
              borderColor: editMode ? '#E8553A' : 'rgba(255,255,255,0.15)',
              background: editMode ? 'rgba(232,85,58,0.12)' : 'none',
              color: editMode ? '#E8553A' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {editMode ? 'Editando' : 'Editar'}
          </button>
        </div>
      </div>

      {/* Zona del libro */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', paddingTop: '56px',
        paddingBottom: '48px',
        marginRight: selectedPageId ? '240px' : '0',
        transition: 'margin 0.2s ease',
        position: 'relative',
      }}>
        <div style={{
          filter: 'drop-shadow(0 24px 64px rgba(0,0,0,0.55))',
          position: 'relative',
          opacity: pageToRestore !== null ? 0 : 1,
          transition: 'opacity 0.2s ease',
        }}>

          {/* Overlay de captura en modo edición (centro 80% — bordes permiten swipe) */}
          {editMode && (
            <div
              style={{
                position: 'absolute',
                top: '10%', bottom: '10%', left: '10%', right: '10%',
                zIndex: 100, cursor: 'crosshair',
              }}
              onClick={(e) => {
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                const isLeft = x < rect.width / 2
                const realPageIndex = isMobile
                  ? currentPage - 1
                  : (currentPage - 1) + (isLeft ? 0 : 1)
                const page = albumPages.pages[realPageIndex]
                if (page) setSelectedPageId(page.id)
              }}
            />
          )}

          <HTMLFlipBook
            key={flipbookKey}
            width={pageSize}
            height={pageSize}
            size="fixed"
            minWidth={150}
            maxWidth={600}
            minHeight={150}
            maxHeight={600}
            showCover={true}
            usePortrait={isMobile}
            drawShadow={true}
            flippingTime={700}
            useMouseEvents={true}
            ref={bookRef}
            onFlip={(e: any) => setCurrentPage(e.data)}
            onInit={() => {
              if (pageToRestore !== null && pageToRestore > 0) {
                requestAnimationFrame(() => {
                  try {
                    bookRef.current?.pageFlip()?.turnToPage(pageToRestore)
                  } catch {
                    // página ya no existe, ignorar
                  }
                  setPageToRestore(null)
                })
              }
            }}
            className=""
            style={{}}
            startPage={0}
            autoSize={false}
            maxShadowOpacity={0.5}
            mobileScrollSupport={false}
            clickEventForward={false}
            swipeDistance={30}
            showPageCorners={true}
            disableFlipByClick={editMode}
            startZIndex={20}
            renderOnlyPageLengthChange={false}
          >
            {flipChildren}
          </HTMLFlipBook>
        </div>
      </div>

      {/* Botones laterales */}
      {!editMode && (
        <>
          <button
            onClick={() => bookRef.current?.pageFlip()?.flipPrev()}
            style={{
              position: 'fixed', left: '20px', top: '50%', transform: 'translateY(-50%)',
              width: '44px', height: '44px', borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'white', fontSize: '20px', cursor: 'pointer',
              opacity: currentPage === 0 ? 0.15 : 1, zIndex: 250,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >‹</button>
          <button
            onClick={() => bookRef.current?.pageFlip()?.flipNext()}
            style={{
              position: 'fixed', right: '20px', top: '50%', transform: 'translateY(-50%)',
              width: '44px', height: '44px', borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'white', fontSize: '20px', cursor: 'pointer',
              opacity: currentPage >= totalPages - 1 ? 0.15 : 1, zIndex: 250,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >›</button>
        </>
      )}

      {/* Panel editor */}
      {selectedPageId && (
        <EditorPanel
          availableLayouts={availableLayouts}
          currentLayout={selectedPage?.layout ?? 'single'}
          selectedPageIndex={selectedPageIndex + 1}
          totalPages={albumPages.pages.length}
          onChangeLayout={handleChangeLayout}
          onClose={() => setSelectedPageId(null)}
        />
      )}

      {/* Barra inferior */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '48px',
        background: 'rgba(10,10,10,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 250,
      }}>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
          {currentPage + 1} / {totalPages}
        </span>
      </div>

    </div>
  )
}
