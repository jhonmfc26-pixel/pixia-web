'use client'

import dynamic from 'next/dynamic'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
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
  turnToPage(page: number): void
  getOrientation(): 'portrait' | 'landscape'
  getCurrentPageIndex(): number
  getSettings(): { disableFlipByClick: boolean }
  getRender(): { getRect(): { left: number; top: number; pageWidth: number; height: number } }
  getFlipController(): { flip(pos: { x: number; y: number }): void }
  getPageCollection(): {
    getCurrentSpreadIndex(): number
    getSpreadIndexByPage(page: number): number
    setCurrentSpreadIndex(idx: number): void
  }
}

/**
 * page-flip 2.0.7 tiene un bug en modo vertical (celular): flipPrev() simula
 * un toque en x=10 del contenedor, pero en vertical la página visible está
 * corrida y ese punto cae fuera de las esquinas; con disableFlipByClick
 * (que usamos para que un toque no pase página) el toque se descarta. Por eso
 * en el celular "‹" y "Portada" no hacían nada. Acá se toca el borde
 * izquierdo de la página VISIBLE y se habilita el toque solo durante esa llamada.
 */
function flipPrevSafe(pf: PageFlipInstance): void {
  if (pf.getOrientation() !== 'portrait') { pf.flipPrev(); return }
  const rect = pf.getRender().getRect()
  const settings = pf.getSettings()
  const prev = settings.disableFlipByClick
  settings.disableFlipByClick = false
  try {
    pf.getFlipController().flip({ x: rect.left + rect.pageWidth + 10, y: 1 })
  } finally {
    settings.disableFlipByClick = prev
  }
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
  // En el celular vertical el libro muestra UNA página a la vez: ahí no hay
  // lomo en el medio de la pantalla y la sombra del hero-spread caía justo
  // en la mitad de una página (Jhon, 2026-11-10).
  const [twoPages, setTwoPages] = useState(!isMobile)
  // Mientras una hoja va pasando, la sombra del lomo del hero-spread quedaba
  // ENCIMA de la hoja que gira (se veía una raya en el medio de la página que
  // pasa). Solo se dibuja con el libro quieto (estado 'read' de pageflip).
  const [turning, setTurning] = useState(false)

  useImperativeHandle(ref, () => ({
    goTo: (spreadIdx: number) => {
      const pf = bookRef.current?.pageFlip()
      if (!pf) return
      const targetPage = spreadIdxToPageIndex(spreadIdx, spreads.length)

      if (pf.getOrientation() === 'portrait') {
        // En vertical se ve una página a la vez: se navega por páginas reales.
        const current = pf.getCurrentPageIndex()
        if (targetPage === current) return
        if (targetPage === current + 1) pf.flipNext()
        else if (targetPage > current) pf.flip(targetPage)
        else if (targetPage === current - 1) flipPrevSafe(pf)
        else {
          // Salto largo hacia atrás ("Portada", miniaturas): flip() usa el
          // mismo flipPrev roto, así que se salta directo, sin animación.
          pf.turnToPage(targetPage)
          currentSpreadIdxRef.current = spreadIdx
          onFlip(spreadIdx)
        }
        return
      }

      const delta = spreadIdx - currentSpreadIdxRef.current
      if (delta === 1) pf.flipNext()
      else if (delta === -1) pf.flipPrev()
      else pf.flip(targetPage)
    },
    flipNext: () => bookRef.current?.pageFlip()?.flipNext(),
    flipPrev: () => { const pf = bookRef.current?.pageFlip(); if (pf) flipPrevSafe(pf) },
  }), [spreads.length, onFlip])

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
        items.push(wrapPage(<FacePageView face={s.left} photosById={photosById} side="left" style={style} />, s.left.id))
        items.push(wrapPage(<FacePageView face={s.right} photosById={photosById} side="right" style={style} />, s.right.id))
      } else {
        items.push(wrapPage(<HeroSpreadPageView face={s.face} photosById={photosById} half="left" />, `${s.face.id}-l`))
        items.push(wrapPage(<HeroSpreadPageView face={s.face} photosById={photosById} half="right" />, `${s.face.id}-r`))
      }
    }
    return items
  }, [spreads, photosById, coverPhoto, cover, style, format])

  const flipbookKey = spreads.map(s => {
    if (s.kind === 'paired') return `${s.left.id}:${s.left.layout}|${s.right.id}:${s.right.layout}`
    if (s.kind === 'composition') return `${s.face.id}:${s.face.layout}`
    return s.kind
  }).join(';') + `:${style}:${format}:${width}x${height}`

  const initialPage = spreadIdxToPageIndex(initialSpreadIdx, spreads.length)

  // react-pageflip registra los eventos DESPUÉS de cargar las páginas, así
  // que el 'init' de la primera carga se pierde: la orientación se lee
  // directo apenas existe el libro (el import es dinámico, puede tardar).
  useEffect(() => {
    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const read = () => {
      const pf = bookRef.current?.pageFlip()
      if (pf) { setTwoPages(pf.getOrientation() !== 'portrait'); return }
      if (++tries < 40) timer = setTimeout(read, 100)
    }
    read()
    return () => clearTimeout(timer)
  }, [flipbookKey])

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
        onInit={(e: { object: PageFlipInstance }) => setTwoPages(e.object.getOrientation() !== 'portrait')}
        onChangeOrientation={(e: { data: string }) => setTwoPages(e.data !== 'portrait')}
        onChangeState={(e: { data: string }) => setTurning(e.data !== 'read')}
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
      {isCompositionCurrent && twoPages && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: `${gutterWidth}px`, background: GUTTER_SHADOW, pointerEvents: 'none', zIndex: 25,
          opacity: turning ? 0 : 1, transition: turning ? 'none' : 'opacity 200ms ease-out',
        }} />
      )}
    </div>
  )
})

export default PixiaFlipBook
