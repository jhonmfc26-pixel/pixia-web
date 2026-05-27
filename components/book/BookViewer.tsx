'use client'

import HTMLFlipBook from 'react-pageflip'
import { useRef, useState, useEffect } from 'react'
import { PixiaBook } from '@/core/domain/PixiaBook'
import EditPanel from './EditPanel'

interface Props {
  book: PixiaBook
  onEmphasize: (photoId: string) => void
  onReduceImpact: (photoId: string) => void
}

function ActBadge({ act }: { act: string }) {
  const label: Record<string, string> = {
    inicio: 'inicio',
    desarrollo: 'desarrollo',
    climax: 'clímax',
    cierre: 'cierre',
  }
  return (
    <div style={{
      position: 'absolute',
      bottom: 8,
      right: 10,
      fontSize: 9,
      color: 'rgba(255,255,255,0.2)',
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      pointerEvents: 'none',
      zIndex: 2,
    }}>
      {label[act] ?? act}
    </div>
  )
}

export default function BookViewer({ book, onEmphasize, onReduceImpact }: Props) {
  const bookRef = useRef<any>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showCaptions, setShowCaptions] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const PAGE_W = isMobile ? Math.floor((window.innerWidth - 48) / 2) : 400
  const PAGE_H = 400

  const totalPages = 1 + book.content.spreads.length * 2 + 1

  const findSpread = (photoId: string) =>
    book.content.spreads.find((s) => s.photos.some((p) => p.id === photoId)) ?? null

  const selectedSpread = selectedPhoto ? findSpread(selectedPhoto) : null
  const handleSelect = (photoId: string) => setSelectedPhoto(photoId)
  const handleClose = () => setSelectedPhoto(null)

  /* ------------------------------------------------------------------ */
  /* Build pages array                                                    */
  /* ------------------------------------------------------------------ */
  const pages: React.ReactNode[] = []

  // — Cover —
  const coverSrc = book.content.spreads[0]?.photos[0]?.src ?? null
  pages.push(
    <div key="cover" style={{ width: '100%', height: '100%', position: 'relative', background: '#1a1a1a' }}>
      {coverSrc ? (
        <>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <img src={coverSrc} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />
          <p style={{
            position: 'absolute', bottom: 28, left: 24, margin: 0,
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400,
            color: '#ffffff', lineHeight: 1.3,
          }}>
            {book.identity.title}
          </p>
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400,
            color: '#ffffff', lineHeight: 1.3, textAlign: 'center', padding: '0 24px' }}>
            {book.identity.title}
          </p>
        </div>
      )}
    </div>
  )

  // — Content pages —
  book.content.spreads.forEach((spread) => {
    const act = spread.act
    const caption = spread.caption ?? ''

    if (spread.layout === 'full-bleed') {
      const photo = spread.photos[0] ?? null

      // Left page
      pages.push(
        <div key={`${spread.id}-L`} style={{ width: '100%', height: '100%', position: 'relative', background: '#0f0f0f' }}>
          {photo && (
            <div onClick={() => handleSelect(photo.id)}
              style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'pointer' }}>
              <img src={photo.src} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '35% center', display: 'block' }} />
            </div>
          )}
          <ActBadge act={act} />
        </div>
      )

      // Right page
      pages.push(
        <div key={`${spread.id}-R`} style={{ width: '100%', height: '100%', position: 'relative', background: '#0f0f0f' }}>
          {photo && (
            <div onClick={() => handleSelect(photo.id)}
              style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'pointer' }}>
              <img src={photo.src} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '65% center', display: 'block' }} />
            </div>
          )}
          {showCaptions && caption && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
              pointerEvents: 'none', zIndex: 3,
            }}>
              <p style={{ margin: 0, fontSize: 11, fontStyle: 'italic',
                fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                {caption}
              </p>
            </div>
          )}
          <ActBadge act={act} />
        </div>
      )
    } else {
      // split-horizontal and editorial-right
      const leftPhoto  = spread.photos[0] ?? null
      const rightPhoto = spread.photos[1] ?? null

      // Left page
      pages.push(
        <div key={`${spread.id}-L`} style={{ width: '100%', height: '100%', position: 'relative', background: '#0f0f0f' }}>
          {leftPhoto && (
            <div onClick={() => handleSelect(leftPhoto.id)}
              style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'pointer' }}>
              <img src={leftPhoto.src} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', display: 'block' }} />
            </div>
          )}
          <ActBadge act={act} />
        </div>
      )

      // Right page
      pages.push(
        <div key={`${spread.id}-R`} style={{ width: '100%', height: '100%', position: 'relative', background: '#0f0f0f' }}>
          {rightPhoto && (
            <div onClick={() => handleSelect(rightPhoto.id)}
              style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'pointer' }}>
              <img src={rightPhoto.src} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', display: 'block' }} />
            </div>
          )}
          {showCaptions && caption && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
              pointerEvents: 'none', zIndex: 3,
            }}>
              <p style={{ margin: 0, fontSize: 11, fontStyle: 'italic',
                fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                {caption}
              </p>
            </div>
          )}
          <ActBadge act={act} />
        </div>
      )
    }
  })

  // — Parity check —
  if (pages.length % 2 !== 0) {
    pages.push(
      <div key="blank" style={{ width: '100%', height: '100%', position: 'relative', background: '#0f0f0f' }} />
    )
  }

  // — Back cover —
  pages.push(
    <div key="back-cover" style={{ width: '100%', height: '100%', position: 'relative', background: '#111' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-pixia.png" alt="Pixia" width={32} height={32} style={{ opacity: 0.5 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        <span style={{ fontSize: 11, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.3)',
          textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif' }}>
          PIXIA
        </span>
      </div>
    </div>
  )

  const isFirstPage = currentPage === 0
  const isLastPage  = currentPage >= totalPages - 1
  const progress    = totalPages > 1 ? (currentPage / totalPages) * 100 : 0

  /* ------------------------------------------------------------------ */
  /* Render                                                               */
  /* ------------------------------------------------------------------ */
  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
        background: 'rgba(10,10,10,0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <a href="/create" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13,
          letterSpacing: '0.02em', textDecoration: 'none' }}>
          ← Volver
        </a>

        <p style={{
          margin: 0, fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400,
          color: 'rgba(255,255,255,0.8)', letterSpacing: '0.01em',
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '45%',
        }}>
          {book.identity.title}
        </p>

        <button
          onClick={() => setShowCaptions(p => !p)}
          style={{
            fontSize: 12,
            color: showCaptions ? 'var(--brand-coral)' : 'rgba(255,255,255,0.4)',
            background: 'none',
            border: '1px solid',
            borderColor: showCaptions ? 'var(--brand-coral)' : 'rgba(255,255,255,0.15)',
            borderRadius: 6,
            padding: '6px 14px',
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          {showCaptions ? 'Ocultar texto' : 'Ver texto'}
        </button>
      </div>

      {/* ── Book centered ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 56 }}>
        <HTMLFlipBook
          ref={bookRef}
          width={PAGE_W}
          height={PAGE_H}
          size="fixed"
          autoSize={false}
          showCover={true}
          usePortrait={false}
          startPage={0}
          drawShadow={true}
          flippingTime={600}
          useMouseEvents={true}
          className=""
          style={{}}
          minWidth={150}
          maxWidth={600}
          minHeight={150}
          maxHeight={600}
          maxShadowOpacity={0.5}
          mobileScrollSupport={false}
          clickEventForward={false}
          swipeDistance={30}
          showPageCorners={true}
          disableFlipByClick={false}
          startZIndex={20}
          renderOnlyPageLengthChange={false}
          onFlip={(e: { data: number }) => setCurrentPage(e.data)}
        >
          {pages}
        </HTMLFlipBook>
      </div>

      {/* ── Side nav buttons ── */}
      <button
        onClick={() => bookRef.current?.pageFlip().flipPrev()}
        disabled={isFirstPage}
        style={{
          position: 'fixed', left: 20, top: '50%', transform: 'translateY(-50%)',
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', cursor: isFirstPage ? 'default' : 'pointer', fontSize: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 40, opacity: isFirstPage ? 0.2 : 1, transition: 'opacity 0.2s',
        }}
      >‹</button>

      <button
        onClick={() => bookRef.current?.pageFlip().flipNext()}
        disabled={isLastPage}
        style={{
          position: 'fixed', right: 20, top: '50%', transform: 'translateY(-50%)',
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', cursor: isLastPage ? 'default' : 'pointer', fontSize: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 40, opacity: isLastPage ? 0.2 : 1, transition: 'opacity 0.2s',
        }}
      >›</button>

      {/* ── Bottom progress bar ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 2,
        background: 'rgba(255,255,255,0.06)', zIndex: 50 }}>
        <div style={{ height: '100%', width: `${progress}%`,
          background: 'var(--brand-coral)', transition: 'width 0.3s ease' }} />
      </div>

      {selectedPhoto && selectedSpread && (
        <EditPanel
          photoId={selectedPhoto}
          spread={selectedSpread}
          onClose={handleClose}
          onEmphasize={(id) => { onEmphasize(id); handleClose() }}
          onReduceImpact={(id) => { onReduceImpact(id); handleClose() }}
        />
      )}
    </div>
  )
}
