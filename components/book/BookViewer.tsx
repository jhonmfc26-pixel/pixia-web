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

export default function BookViewer({ book, onEmphasize, onReduceImpact }: Props) {
  const flipRef = useRef<any>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const PAGE_W = isMobile ? Math.floor(window.innerWidth - 32) : 460
  const PAGE_H = Math.floor(PAGE_W * 1.4)

  const findSpread = (photoId: string) =>
    book.content.spreads.find((s) => s.photos.some((p) => p.id === photoId)) ?? null

  const selectedSpread = selectedPhoto ? findSpread(selectedPhoto) : null

  const handleSelect = (photoId: string) => setSelectedPhoto(photoId)
  const handleClose  = () => setSelectedPhoto(null)

  /* ------------------------------------------------------------------ */
  /* Build flat pages array: cover + [left, right] per spread + back     */
  /* ------------------------------------------------------------------ */
  const pages: React.ReactNode[] = []

  // Front cover — single page (showCover treats it as hard cover)
  const coverPhoto = book.content.spreads[0]?.photos[0]?.src ?? null
  pages.push(
    <div key="cover" style={{ width: '100%', height: '100%', position: 'relative', background: '#0D0D0D' }}>
      {coverPhoto && (
        <img
          src={coverPhoto}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {/* Bottom title overlay */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        padding: '32px 28px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
      }}>
        <p style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 400,
          color: '#ffffff',
          letterSpacing: '0.02em',
          lineHeight: 1.3,
        }}>
          {book.identity.title}
        </p>
      </div>
    </div>
  )

  // Content pages
  book.content.spreads.forEach((spread) => {
    if (spread.layout === 'full-bleed') {
      const photo = spread.photos[0] ?? null

      // Left page — left half of image
      pages.push(
        <div key={`${spread.id}-left`} style={{ width: '100%', height: '100%', position: 'relative' }}>
          {photo && (
            <div onClick={() => handleSelect(photo.id)} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
              <img
                src={photo.src}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'left center', display: 'block' }}
              />
            </div>
          )}
        </div>
      )

      // Right page — right half of image
      pages.push(
        <div key={`${spread.id}-right`} style={{ width: '100%', height: '100%', position: 'relative' }}>
          {photo && (
            <div onClick={() => handleSelect(photo.id)} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
              <img
                src={photo.src}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'right center', display: 'block' }}
              />
            </div>
          )}
        </div>
      )

    } else {
      // split-horizontal and editorial-right — two distinct photos
      const leftPhoto  = spread.photos[0] ?? null
      const rightPhoto = spread.photos[1] ?? null

      // Left page
      pages.push(
        <div key={`${spread.id}-left`} style={{ width: PAGE_W, height: PAGE_H, position: 'relative', background: '#f8f7f5', borderRight: '1px solid #e0ddd8' }}>
          {leftPhoto ? (
            <div onClick={() => handleSelect(leftPhoto.id)} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
              <img
                src={leftPhoto.src}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          ) : (
            <Blank />
          )}
        </div>
      )

      // Right page
      pages.push(
        <div key={`${spread.id}-right`} style={{ width: PAGE_W, height: PAGE_H, position: 'relative', background: '#f8f7f5', borderLeft: '1px solid #e0ddd8' }}>
          {rightPhoto ? (
            <>
              <div onClick={() => handleSelect(rightPhoto.id)} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
                <img
                  src={rightPhoto.src}
                  alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
              {spread.layout === 'editorial-right' && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)', pointerEvents: 'none' }} />
              )}
            </>
          ) : (
            <Blank />
          )}
        </div>
      )
    }
  })

  // Parity check: with showCover=true total children must be even.
  // pages.length before back cover = 1 (cover) + 2*N (interior).
  // If that count is even, adding back cover makes it odd → insert blank first.
  if (pages.length % 2 === 0) {
    pages.push(
      <div key="blank" style={{ background: '#f7f4ef', width: '100%', height: '100%' }} />
    )
  }

  // Back cover — last photo full-bleed, top overlay, centered PIXIA
  const lastSpread = book.content.spreads[book.content.spreads.length - 1]
  const backPhoto = lastSpread?.photos[lastSpread.photos.length - 1]?.src ?? null
  pages.push(
    <div key="back-cover" style={{ width: '100%', height: '100%', position: 'relative', background: '#111' }}>
      {backPhoto && (
        <img
          src={backPhoto}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {/* Top gradient overlay */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 50%)',
      }} />
      {/* PIXIA centered */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontSize: 11,
          letterSpacing: '0.3em',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          fontFamily: 'system-ui, sans-serif',
        }}>
          PIXIA
        </span>
      </div>
    </div>
  )

  /* ------------------------------------------------------------------ */
  /* Render                                                               */
  /* ------------------------------------------------------------------ */
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#1a1a1a',
        minHeight: '100vh',
        padding: '40px 0',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        <NavButton onClick={() => flipRef.current?.pageFlip().flipPrev()}>← Anterior</NavButton>
        <NavButton onClick={() => flipRef.current?.pageFlip().flipNext()}>Siguiente →</NavButton>
      </div>

      <HTMLFlipBook
        ref={flipRef}
        className=""
        style={{}}
        width={PAGE_W}
        height={PAGE_H}
        size="fixed"
        minWidth={200}
        maxWidth={1000}
        minHeight={300}
        maxHeight={1533}
        drawShadow
        flippingTime={700}
        usePortrait={isMobile}
        startZIndex={20}
        autoSize={false}
        maxShadowOpacity={0.6}
        showCover
        mobileScrollSupport={false}
        clickEventForward={false}
        useMouseEvents
        swipeDistance={30}
        showPageCorners
        disableFlipByClick={false}
        startPage={0}
        renderOnlyPageLengthChange
      >
        {pages}
      </HTMLFlipBook>

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

function Blank() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ccc', fontSize: 12 }}>
      —
    </div>
  )
}

function NavButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 28px',
        borderRadius: 6,
        border: '1px solid #444',
        background: '#2a2a2a',
        color: '#fff',
        cursor: 'pointer',
        fontSize: 14,
        letterSpacing: 0.5,
      }}
    >
      {children}
    </button>
  )
}
