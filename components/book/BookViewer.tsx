'use client'

import HTMLFlipBook from 'react-pageflip'
import { useRef, useState, useEffect } from 'react'
import { PixiaBook, ActId } from '@/core/domain/PixiaBook'
import EditPanel from './EditPanel'

const ACT_COLORS: Record<ActId, string> = {
  inicio:     '#9ca3af',
  desarrollo: '#f59e0b',
  climax:     '#ec4899',
  cierre:     '#a78bfa',
}

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
  pages.push(
    <div
      key="cover"
      style={{
        background: '#0f0f0f',
        width: PAGE_W,
        height: PAGE_H,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: 'inset -6px 0 18px rgba(0,0,0,0.5)',
      }}
    >
      <h1 style={{ fontSize: 26, fontFamily: 'Georgia, serif', textAlign: 'center', padding: '0 40px', lineHeight: 1.4 }}>
        {book.identity.title}
      </h1>
      <p style={{ marginTop: 16, fontSize: 11, color: '#555', letterSpacing: 2, textTransform: 'uppercase' }}>
        Pixia Editorial
      </p>
    </div>
  )

  // Content pages
  book.content.spreads.forEach((spread) => {
    const leftPhoto  = spread.photos[0] ?? null
    const rightPhoto = spread.photos[1] ?? null
    const actColor   = ACT_COLORS[spread.act]

    // Left page
    pages.push(
      <div
        key={`${spread.id}-left`}
        style={{
          background: '#f8f7f5',
          width: PAGE_W,
          height: PAGE_H,
          position: 'relative',
          overflow: 'hidden',
          borderRight: '1px solid #e0ddd8',
        }}
      >
        {leftPhoto ? (
          <>
            <div
              onClick={() => handleSelect(leftPhoto.id)}
              style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
            >
              <img src={leftPhoto.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <span style={{
              position: 'absolute', top: 12, left: 12,
              background: actColor, color: '#fff', fontSize: 9,
              padding: '3px 10px', borderRadius: 20, fontWeight: 700,
              letterSpacing: 1.5, textTransform: 'uppercase',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}>
              {spread.act}
            </span>
          </>
        ) : (
          <Blank />
        )}
      </div>
    )

    // Right page
    pages.push(
      <div
        key={`${spread.id}-right`}
        style={{
          background: '#f8f7f5',
          width: PAGE_W,
          height: PAGE_H,
          position: 'relative',
          overflow: 'hidden',
          borderLeft: '1px solid #e0ddd8',
        }}
      >
        {rightPhoto ? (
          <>
            <div
              onClick={() => handleSelect(rightPhoto.id)}
              style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
            >
              <img src={rightPhoto.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <span style={{
              position: 'absolute', top: 12, right: 12,
              background: actColor, color: '#fff', fontSize: 9,
              padding: '3px 10px', borderRadius: 20, fontWeight: 700,
              letterSpacing: 1.5, textTransform: 'uppercase',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}>
              {spread.act}
            </span>
          </>
        ) : (
          <Blank />
        )}
      </div>
    )
  })

  // Back cover
  pages.push(
    <div
      key="back-cover"
      style={{
        background: '#0f0f0f',
        width: PAGE_W,
        height: PAGE_H,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'inset 6px 0 18px rgba(0,0,0,0.5)',
      }}
    >
      <p style={{ color: '#333', fontSize: 11, fontFamily: 'Georgia, serif', letterSpacing: 2 }}>
        PIXIA · {new Date().getFullYear()}
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
