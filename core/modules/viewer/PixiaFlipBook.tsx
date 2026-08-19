'use client'

import dynamic from 'next/dynamic'
import { forwardRef, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react'
import type { AlbumStyle, AlbumFormat, CoverConfig, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import { FacePageView, HeroSpreadPageView } from './SpreadFaces'
import CoverPage from './pages/CoverPage'
import BackCoverPage from './pages/BackCoverPage'
import { spreadIdxToPageIndex, pageIndexToSpreadIdx, type ViewerSpread } from './spreadModel'

// react-pageflip toca `document`/`window` al montar — sin esto, el SSR de
// Next revienta con pantalla negra (motivo original del incidente).
const HTMLFlipBook = dynamic(() => import('react-pageflip'), { ssr: false })

const GUTTER_SHADOW =
  'linear-gradient(to right,' +
  'rgba(0,0,0,0) 0%,' +
  'rgba(0,0,0,0.14) 45%,' +
  'rgba(0,0,0,0.22) 50%,' +
  'rgba(0,0,0,0.14) 55%,' +
  'rgba(0,0,0,0) 100%)'

const PAGE_RADIUS = 3

interface PageFlipInstance {
  flipNext(): void
  flipPrev(): void
  /** Salto animado a una página — a diferencia de turnToPage(), SÍ anima el curl. */
  flip(page: number): void
}

export interface PixiaFlipBookHandle {
  goTo: (spreadIdx: number) => void
  flipNext: () => void
  flipPrev: () => void
}

interface PixiaFlipBookProps {
  spreads: ViewerSpread[]
  photosById: Map<string, PhotoAsset>
  coverPhoto: PhotoAsset | undefined
  cover: CoverConfig
  style: AlbumStyle
  format: AlbumFormat
  width: number
  height: number
  isMobile: boolean
  /** El pliego actual es un hero-spread — solo entonces se dibuja el overlay
   * global de lomo; los "paired" ya llevan su propia sombra por página. */
  isCompositionCurrent: boolean
  gutterWidth: number
  initialSpreadIdx: number
  onFlip: (spreadIdx: number) => void
}

// Papel opaco — react-pageflip clona este nodo (cloneNode) para la cara que
// gira. El motor (page-flip) hace `element.style.cssText = "..."` en CADA
// frame de dibujo (drawHard/drawSoft/simpleDraw) para animar transform/size —
// esa asignación REEMPLAZA el atributo style completo, no lo mezcla, así que
// cualquier background puesto inline (vía prop `style` de React) se borra en
// el primer frame de animación y la hoja queda transparente a mitad del giro.
// Por eso el fondo del papel va por clase CSS, no por style inline: una regla
// de clase sobrevive a esa reescritura porque vive fuera del atributo style.
const PAPER_BG = '#F9F6F1'
const PAGE_CLASS = 'pixia-flip-page'
const PAGE_CSS = `.${PAGE_CLASS} { background: ${PAPER_BG}; overflow: hidden; border-radius: ${PAGE_RADIUS}px; }`

function wrapPage(content: ReactNode, key: string) {
  return (
    <div key={key} className={PAGE_CLASS} style={{ width: '100%', height: '100%' }}>
      {content}
    </div>
  )
}

const PixiaFlipBook = forwardRef<PixiaFlipBookHandle, PixiaFlipBookProps>(function PixiaFlipBook(
  {
    spreads, photosById, coverPhoto, cover, style, format,
    width, height, isMobile, isCompositionCurrent, gutterWidth,
    initialSpreadIdx, onFlip,
  },
  ref,
) {
  const bookRef = useRef<{ pageFlip(): PageFlipInstance } | null>(null)
  // Último spreadIdx confirmado por onFlip — permite distinguir "página
  // siguiente/anterior" (usa flipNext/flipPrev, que SÍ animan el curl) de un
  // salto largo (usa flip(), que también anima pero con otra coreografía;
  // turnToPage() en cambio es instantáneo y se evita a propósito).
  const currentSpreadIdxRef = useRef(initialSpreadIdx)

  useImperativeHandle(ref, () => ({
    goTo: (spreadIdx: number) => {
      const pf = bookRef.current?.pageFlip()
      if (!pf) return
      const delta = spreadIdx - currentSpreadIdxRef.current
      if (delta === 1) pf.flipNext()
      else if (delta === -1) pf.flipPrev()
      else pf.flip(spreadIdxToPageIndex(spreadIdx, spreads.length))
    },
    flipNext: () => bookRef.current?.pageFlip()?.flipNext(),
    flipPrev: () => bookRef.current?.pageFlip()?.flipPrev(),
  }), [spreads.length])

  const flipChildren = useMemo(() => {
    const items: ReactNode[] = []
    for (const s of spreads) {
      if (s.kind === 'cover') {
        items.push(wrapPage(
          <CoverPage photo={coverPhoto} cover={cover} style={style} format={format} />,
          'cover',
        ))
      } else if (s.kind === 'back') {
        items.push(wrapPage(<BackCoverPage />, 'back'))
      } else if (s.kind === 'paired') {
        items.push(wrapPage(<FacePageView face={s.left} photosById={photosById} side="left" />, s.left.id))
        items.push(wrapPage(<FacePageView face={s.right} photosById={photosById} side="right" />, s.right.id))
      } else {
        items.push(wrapPage(<HeroSpreadPageView face={s.face} photosById={photosById} half="left" />, `${s.face.id}-l`))
        items.push(wrapPage(<HeroSpreadPageView face={s.face} photosById={photosById} half="right" />, `${s.face.id}-r`))
      }
    }
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreads, photosById, coverPhoto, cover, style, format])

  const flipbookKey = spreads.map(s => {
    if (s.kind === 'paired') return `${s.left.id}:${s.left.layout}|${s.right.id}:${s.right.layout}`
    if (s.kind === 'composition') return `${s.face.id}:${s.face.layout}`
    return s.kind
  }).join(';') + `:${style}:${format}:${width}x${height}`

  const initialPage = spreadIdxToPageIndex(initialSpreadIdx, spreads.length)

  return (
    <div style={{
      position: 'relative',
      // Sombra gris cálida y difusa — sobre fondo claro, una sombra negra
      // dura se ve "recortada"; esta se difumina como si el libro
      // descansara sobre una superficie real.
      filter: 'drop-shadow(0 26px 48px rgba(80,68,52,0.22)) drop-shadow(0 8px 20px rgba(80,68,52,0.16))',
    }}>
      <style>{PAGE_CSS}</style>
      <HTMLFlipBook
        key={flipbookKey}
        width={width}
        height={height}
        size="fixed"
        minWidth={100} maxWidth={2200}
        minHeight={100} maxHeight={2200}
        showCover={true}
        usePortrait={isMobile}
        drawShadow={true}
        flippingTime={700}
        useMouseEvents={true}
        ref={bookRef}
        onFlip={(e: { data: number }) => {
          const idx = pageIndexToSpreadIdx(e.data, spreads.length)
          currentSpreadIdxRef.current = idx
          onFlip(idx)
        }}
        onInit={() => {}}
        className="" style={{}}
        startPage={initialPage}
        autoSize={false}
        maxShadowOpacity={0.4}
        mobileScrollSupport={false}
        clickEventForward={false}
        swipeDistance={30}
        showPageCorners={true}
        disableFlipByClick={true}
        startZIndex={20}
        renderOnlyPageLengthChange={false}
      >
        {flipChildren}
      </HTMLFlipBook>

      {/* Overlay global — solo para hero-spread: es UNA foto continua, no
          tiene dos caras propias donde poner la sombra por página. Los
          "paired" ya la llevan en su borde interior (viaja con la hoja). */}
      {isCompositionCurrent && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: `${gutterWidth}px`, background: GUTTER_SHADOW, pointerEvents: 'none', zIndex: 25,
        }} />
      )}
    </div>
  )
})

export default PixiaFlipBook
