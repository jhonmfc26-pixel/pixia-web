'use client'
import HTMLFlipBook from 'react-pageflip'
import { useState, useRef, useEffect } from 'react'
import type { AlbumStyle, PhotoAsset, CoverConfig, AlbumFormat } from '@/core/contracts/AlbumBlueprint'
import type { Page, PhotoPlacement } from '@/core/modules/album/types'
import PageRenderer from './PageRenderer'
import CoverPage from './pages/CoverPage'
import BackCoverPage from './pages/BackCoverPage'
import BlankPage from './pages/BlankPage'

interface PixiaViewerProps {
  pages: Page[]
  photosById: Map<string, PhotoAsset>
  placements: Map<string, PhotoPlacement>
  coverPhoto: PhotoAsset | undefined
  cover: CoverConfig
  style: AlbumStyle
  format: AlbumFormat
  title: string
  onEdit?: (currentPage: number) => void
  startPage?: number
}

export default function PixiaViewer({
  pages, photosById, placements,
  coverPhoto, cover, style, format, title, onEdit, startPage,
}: PixiaViewerProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [pageSize, setPageSize] = useState(420)
  const [pageInput, setPageInput] = useState('1')

  useEffect(() => {
    setPageInput((currentPage + 1).toString())
  }, [currentPage])

  const handleGoToPage = (target: number) => {
    if (isNaN(target) || target < 1 || target > totalPages) {
      setPageInput((currentPage + 1).toString())
      return
    }
    bookRef.current?.pageFlip()?.turnToPage(target - 1)
  }

  const handleGoToCover = () => {
    bookRef.current?.pageFlip()?.turnToPage(0)
  }
  const bookRef = useRef<{
    pageFlip(): {
      flipPrev(): void
      flipNext(): void
      turnToPage(page: number): void
    }
  } | null>(null)

  useEffect(() => {
    function calc() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      setPageSize(mobile
        ? Math.min(window.innerWidth - 32, 340)
        : Math.min(window.innerHeight - 56 - 48 - 32, 480)
      )
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  const innerPages = pages.length
  const needsBlank = innerPages % 2 !== 0
  const totalPages = 1 + innerPages + (needsBlank ? 1 : 0) + 1

  const flipbookKey = pages.map(p => `${p.id}:${p.layout}`).join('|') + `:${style}:${needsBlank}`

  const flipChildren = [
    <div key="cover" style={{ width: '100%', height: '100%' }}>
      <CoverPage
        photo={coverPhoto}
        cover={cover}
        style={style}
        format={format}
      />
    </div>,

    ...pages.map(page => (
      <div key={page.id} style={{ width: '100%', height: '100%' }}>
        <PageRenderer
          page={page}
          photosById={photosById}
          placements={placements}
          style={style}
        />
      </div>
    )),

    ...(needsBlank ? [
      <div key="blank" style={{ width: '100%', height: '100%' }}>
        <BlankPage style={style} />
      </div>,
    ] : []),

    <div key="back" style={{ width: '100%', height: '100%' }}>
      <BackCoverPage style={style} />
    </div>,
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0D0D0D', display: 'flex', flexDirection: 'column' }}>

      {/* Barra superior */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', zIndex: 300,
      }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px' }}
        >
          ← Volver
        </button>

        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', color: 'white' }}>
          {title}
        </span>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: '60px', justifyContent: 'flex-end' }}>
          {onEdit && (
            <button
              onClick={() => onEdit(currentPage)}
              style={{
                fontSize: '12px', padding: '6px 14px', borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
              }}
            >
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Zona del libro */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingTop: '56px', paddingBottom: '48px',
      }}>
        <div style={{ filter: 'drop-shadow(0 24px 64px rgba(0,0,0,0.55))' }}>
          <HTMLFlipBook
            key={flipbookKey}
            width={pageSize}
            height={pageSize}
            size="fixed"
            minWidth={150} maxWidth={600}
            minHeight={150} maxHeight={600}
            showCover={true}
            usePortrait={isMobile}
            drawShadow={true}
            flippingTime={700}
            useMouseEvents={true}
            ref={bookRef}
            onFlip={(e: { data: number }) => setCurrentPage(e.data)}
            onInit={() => {}}
            className="" style={{}}
            startPage={startPage ?? 0} autoSize={false}
            maxShadowOpacity={0.5}
            mobileScrollSupport={false}
            clickEventForward={false}
            swipeDistance={30}
            showPageCorners={true}
            disableFlipByClick={false}
            startZIndex={20}
            renderOnlyPageLengthChange={false}
          >
            {flipChildren}
          </HTMLFlipBook>
        </div>
      </div>

      {/* Flechas de navegación */}
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

      {/* Barra inferior */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '48px',
        background: 'rgba(10,10,10,0.95)', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          fontSize: '13px', color: 'rgba(255,255,255,0.7)',
        }}>
          <button
            onClick={handleGoToCover}
            title="Ir a portada"
            disabled={currentPage === 0}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px',
              padding: '4px 10px',
              color: currentPage === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
              fontSize: '13px',
              cursor: currentPage === 0 ? 'default' : 'pointer',
              lineHeight: 1,
            }}
          >↺ Portada</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Página</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                  handleGoToPage(parseInt(pageInput, 10))
                }
              }}
              onBlur={() => handleGoToPage(parseInt(pageInput, 10))}
              style={{
                width: '50px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '4px',
                padding: '4px 6px',
                color: 'white',
                fontSize: '13px',
                textAlign: 'center',
                outline: 'none',
              }}
            />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>/ {totalPages}</span>
          </div>
        </div>
      </div>

    </div>
  )
}
