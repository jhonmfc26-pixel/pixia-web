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

  // Front cover
  const coverPhoto = book.content.spreads[0]?.photos[0]?.src ?? null
  pages.push(
    <div
      key="cover"
      style={{
        width: PAGE_W,
        height: PAGE_H,
        position: 'relative',
        overflow: 'hidden',
        background: '#1a1a1a',
        boxShadow: 'inset -6px 0 18px rgba(0,0,0,0.5)',
      }}
    >
      {coverPhoto && (
        <img
          src={coverPhoto}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {/* Bottom gradient overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)',
      }} />
      {/* Title block */}
      <div style={{
        position: 'absolute',
        bottom: 36,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '0 32px',
      }}>
        <p style={{
          margin: 0,
          color: '#ffffff',
          fontSize: 22,
          fontWeight: 300,
          letterSpacing: '0.08em',
          textAlign: 'center',
          fontFamily: 'Georgia, serif',
          lineHeight: 1.35,
        }}>
          {book.identity.title}
        </p>
        <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.3)' }} />
        <p style={{
          margin: 0,
          color: 'rgba(255,255,255,0.6)',
          fontSize: 11,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          fontFamily: 'system-ui, sans-serif',
        }}>
          {new Date(book.identity.createdAt).getFullYear()}
        </p>
      </div>
    </div>
  )

  // Content pages
  const badge: React.CSSProperties = {
    position: 'absolute', bottom: 12, left: 0, right: 0,
    textAlign: 'center', pointerEvents: 'none',
    color: 'rgba(255,255,255,0.2)', fontSize: 9,
    letterSpacing: '0.15em', textTransform: 'uppercase',
    fontFamily: 'system-ui, sans-serif',
  }

  book.content.spreads.forEach((spread) => {
    if (spread.layout === 'full-bleed') {
      const photo = spread.photos[0] ?? null

      // Left page — 35% anchor keeps subject away from spine
      pages.push(
        <div key={`${spread.id}-left`} style={{ background: '#111', width: PAGE_W, height: PAGE_H, position: 'relative', overflow: 'hidden' }}>
          {photo && (
            <div onClick={() => handleSelect(photo.id)} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
              <img src={photo.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '35% center', display: 'block' }} />
            </div>
          )}
          <span style={badge}>{spread.act}</span>
        </div>
      )

      // Right page — 65% anchor, mirror of left
      pages.push(
        <div key={`${spread.id}-right`} style={{ background: '#111', width: PAGE_W, height: PAGE_H, position: 'relative', overflow: 'hidden' }}>
          {photo && (
            <div onClick={() => handleSelect(photo.id)} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
              <img src={photo.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '65% center', display: 'block' }} />
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
        <div key={`${spread.id}-left`} style={{ background: '#f8f7f5', width: PAGE_W, height: PAGE_H, position: 'relative', overflow: 'hidden', borderRight: '1px solid #e0ddd8' }}>
          {leftPhoto ? (
            <>
              <div onClick={() => handleSelect(leftPhoto.id)} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
                <img src={leftPhoto.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <span style={badge}>{spread.act}</span>
            </>
          ) : (
            <Blank />
          )}
        </div>
      )

      // Right page
      pages.push(
        <div key={`${spread.id}-right`} style={{ background: '#f8f7f5', width: PAGE_W, height: PAGE_H, position: 'relative', overflow: 'hidden', borderLeft: '1px solid #e0ddd8' }}>
          {rightPhoto ? (
            <>
              <div onClick={() => handleSelect(rightPhoto.id)} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
                <img src={rightPhoto.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              {spread.layout === 'editorial-right' && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)', pointerEvents: 'none' }} />
              )}
              <span style={badge}>{spread.act}</span>
            </>
          ) : (
            <Blank />
          )}
        </div>
      )
    }
  })

  // Back cover — last photo as full-bleed with top gradient
  const lastSpread = book.content.spreads[book.content.spreads.length - 1]
  const backPhoto = lastSpread?.photos[lastSpread.photos.length - 1]?.src ?? null
  pages.push(
    <div
      key="back-cover"
      style={{
        width: PAGE_W,
        height: PAGE_H,
        position: 'relative',
        overflow: 'hidden',
        background: '#111',
        boxShadow: 'inset 6px 0 18px rgba(0,0,0,0.5)',
      }}
    >
      {backPhoto && (
        <img
          src={backPhoto}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {/* Top gradient overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 40%, transparent 70%)',
      }} />
      {/* PIXIA mark at top */}
      <p style={{
        position: 'absolute',
        top: 28,
        left: 0,
        right: 0,
        margin: 0,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
        letterSpacing: '0.35em',
        textTransform: 'uppercase',
        fontFamily: 'system-ui, sans-serif',
      }}>
        PIXIA
      </p>
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
      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        <NavButton onClick={() => flipRef.current?.pageFlip().flipPrev()}>← Anterior</NavButton>
        <NavButton onClick={() => flipRef.current?.pageFlip().flipNext()}>Siguiente →</NavButton>
      </div>

      {/* Book */}
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

      {/* Edit panel overlay */}
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
