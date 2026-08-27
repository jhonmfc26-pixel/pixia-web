'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LayoutGrid, ChevronsLeft, ChevronsRight } from 'lucide-react'

export interface ThumbnailItem {
  key: string
  /** Número/etiqueta visible bajo la miniatura (posición dentro del álbum). */
  label: string
  /** width / height del thumbnail — 1 para portada/contraportada/cara suelta, 2 para un pliego (dos caras lado a lado). */
  aspectRatio: number
  render: ReactNode
}

interface PageThumbnailStripProps {
  items: ThumbnailItem[]
  currentIndex: number
  onSelect: (index: number) => void
  /** Alto del bottom bar existente de la página anfitriona — la tira se ancla justo arriba, nunca lo tapa. */
  bottomBarHeight: number
}

const HIDE_DELAY_MS = 500
const HOVER_ZONE_HEIGHT = 28
const STRIP_HEIGHT = 116
const THUMB_H = 60
const TRACK_H = 16   // alto del área de arrastre (hit-area) de la scrollbar — la barra visible es más fina, dentro de esto

/**
 * Tira de miniaturas para saltar de página — reusable entre el viewer
 * (/book/[id]) y el editor (/edit-v2). No sabe nada de AlbumStructure ni de
 * ViewerSpread: cada caller arma su propia lista de `items` (con SU sistema
 * de navegación real — goTo/currentFold) y esta solo dibuja/gestiona la UI.
 *
 * Visibilidad (desktop) por "hold": la tira se revela y se queda revelada
 * mientras CUALQUIERA de estas señales esté activa — mouse sobre el
 * contenedor (que hace de franja de detección chica cuando está cerrado, y
 * de tira completa cuando está abierto — mismo elemento, un solo par de
 * mouseenter/mouseleave, ver comentario junto a isHeld) o un arrastre en
 * curso (de las miniaturas o de la scrollbar propia). Recién cuando NINGUNA
 * está activa arranca el delay de ocultamiento — así nunca se cierra a media
 * interacción, solo al soltar todo y alejar el mouse. Un wheel event en
 * cualquier parte también revela momentáneamente (estas vistas no tienen
 * scroll de página real).
 *
 * Navegación rápida en álbumes largos: scrollbar horizontal propia (fina,
 * arrastrable de punta a punta, coral mientras se arrastra) además del
 * scroll por rueda/arrastre directo sobre las miniaturas, más botones ‹‹/››
 * para saltar a la primera/última página con un clic.
 *
 * Móvil (sin hover): un botón flotante (grid) que abre/cierra la tira; tocar
 * una miniatura navega Y la cierra.
 */
export default function PageThumbnailStrip({ items, currentIndex, onSelect, bottomBarHeight }: PageThumbnailStripProps) {
  const [isDesktop, setIsDesktop] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [barDragging, setBarDragging] = useState(false)

  useEffect(() => {
    setIsDesktop(window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  }, [])

  // ── Sistema de "hold" — reemplaza el viejo cálculo de distancia al borde,
  // que no cubría el área real de la tira ya abierta (por eso se cerraba
  // justo al intentar usarla). Cada fuente de interacción prende su propia
  // bandera; mientras alguna esté prendida, jamás se programa el ocultado.
  //
  // OJO: el hover y el "hold por arrastre" son DOS banderas separadas
  // (holdStrip / holdDrag) sobre el MISMO elemento contenedor — a propósito.
  // Una primera versión de esto tenía una franja invisible aparte (para
  // detectar la cercanía antes de abrir) superpuesta al área de la tira ya
  // abierta, alternando pointer-events entre las dos — eso hacía que el
  // mouseenter/mouseleave de la franja dejara de dispararse en cuanto se
  // volvía inerte, atascando su bandera en `true` para siempre y la tira
  // nunca se volvía a cerrar. Ahora es UN solo elemento (crece de una franja
  // chica a la tira completa) con un solo par de mouseenter/mouseleave —
  // sin costura entre dos hitboxes, sin bandera que se pueda atascar.
  const holdStrip = useRef(false)
  const holdDrag = useRef(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isHeld = () => holdStrip.current || holdDrag.current

  const reveal = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
    setRevealed(true)
  }
  // "Soltar" una señal de hold — solo programa el ocultado si NINGUNA otra
  // señal sigue activa (nunca oculta a media interacción).
  const release = () => {
    if (isHeld()) return
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setRevealed(false), HIDE_DELAY_MS)
  }

  useEffect(() => {
    if (!isDesktop) return
    const onWheel = () => { reveal(); release() }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop])

  const open = isDesktop ? revealed : mobileOpen

  // ── Scroll horizontal de las miniaturas (rueda + arrastre directo) ────────
  const stripRef = useRef<HTMLDivElement>(null)
  const rowDragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null)

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = stripRef.current
    if (!el) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY
    e.stopPropagation() // no reactivar el wheel de revelado de arriba — ya está revelada
  }
  // Sin setPointerCapture acá a propósito (a diferencia de la scrollbar más
  // abajo): este pointerdown también burbujea desde el click de CADA botón
  // de miniatura (son hijos de esta fila) — capturar el puntero en la fila
  // puede robarle el pointerup al botón y romper "clic en miniatura navega".
  // La scrollbar no tiene ese problema porque no contiene botones adentro.
  const handleRowPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    rowDragRef.current = { startX: e.clientX, startScrollLeft: stripRef.current?.scrollLeft ?? 0 }
    holdDrag.current = true
    reveal()
  }
  const handleRowPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rowDragRef.current || !stripRef.current) return
    stripRef.current.scrollLeft = rowDragRef.current.startScrollLeft - (e.clientX - rowDragRef.current.startX)
  }
  const endRowDrag = () => {
    rowDragRef.current = null
    holdDrag.current = false
    release()
  }

  // ── Scrollbar propia — visible, fina, arrastrable, coral al arrastrar ─────
  const trackRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState({ scrollLeft: 0, scrollWidth: 1, clientWidth: 1 })
  const barDragRef = useRef(false)

  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const update = () => setMetrics({ scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', update); ro.disconnect() }
  }, [items.length])

  const scrollableRange = Math.max(0, metrics.scrollWidth - metrics.clientWidth)
  const thumbRatio = metrics.scrollWidth > 0 ? Math.min(1, metrics.clientWidth / metrics.scrollWidth) : 1
  const scrollRatio = scrollableRange > 0 ? metrics.scrollLeft / scrollableRange : 0
  const thumbLeftPct = scrollRatio * (100 - thumbRatio * 100)

  const moveBarToClientX = (clientX: number) => {
    const track = trackRef.current
    const el = stripRef.current
    if (!track || !el || scrollableRange <= 0) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    el.scrollLeft = ratio * scrollableRange
  }
  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    barDragRef.current = true
    setBarDragging(true)
    holdDrag.current = true
    reveal()
    moveBarToClientX(e.clientX)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!barDragRef.current) return
    moveBarToClientX(e.clientX)
  }
  const endTrackDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    barDragRef.current = false
    setBarDragging(false)
    holdDrag.current = false
    release()
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ya liberado */ }
  }

  // Mantener la miniatura activa visible cuando cambia la página actual.
  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [currentIndex, open])

  const handleSelect = (i: number) => {
    onSelect(i)
    if (!isDesktop) setMobileOpen(false)
  }

  const jumpToStart = () => handleSelect(0)
  const jumpToEnd = () => handleSelect(items.length - 1)

  const anchorBottom = `calc(${bottomBarHeight}px + env(safe-area-inset-bottom, 0px))`

  return (
    <>
      {/* Botón móvil — reemplaza el gesto de hover que no existe en touch */}
      {!isDesktop && (
        <button
          onClick={() => setMobileOpen(v => !v)}
          aria-label={mobileOpen ? 'Cerrar miniaturas' : 'Ver miniaturas de páginas'}
          style={{
            position: 'fixed', right: '16px',
            bottom: `calc(${bottomBarHeight}px + 12px + env(safe-area-inset-bottom, 0px))`,
            width: '40px', height: '40px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: mobileOpen ? '#E8553A' : 'rgba(20,20,20,0.85)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#fff', cursor: 'pointer',
            zIndex: 131,
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
            transition: 'background 0.15s',
          }}
        >
          <LayoutGrid size={17} strokeWidth={1.6} />
        </button>
      )}

      {/*
        Un solo elemento hace de "franja de detección" (chico, invisible,
        HOVER_ZONE_HEIGHT) Y de tira revelada (STRIP_HEIGHT) — nunca dos
        hitboxes superpuestas con pointer-events alternando entre ellas (ver
        comentario junto a isHeld). Mientras cerrado, es transparente y solo
        ocupa HOVER_ZONE_HEIGHT — el contenido real vive en un hijo con su
        propio fade/slide, así que crecer no se siente como un salto brusco.
      */}
      <div
        onMouseEnter={isDesktop ? () => { holdStrip.current = true; reveal() } : undefined}
        onMouseLeave={isDesktop ? () => { holdStrip.current = false; release() } : undefined}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: anchorBottom,
          // Desktop cerrado: solo la franja de detección. Abierto (desktop o
          // móvil): la tira completa. Móvil cerrado: nada — ahí no hay hover,
          // el gesto es el botón flotante, así que no hace falta una hitbox
          // inerte tapando contenido del viewer/editor detrás.
          height: open ? `${STRIP_HEIGHT}px` : isDesktop ? `${HOVER_ZONE_HEIGHT}px` : '0px',
          zIndex: 130,
          pointerEvents: open || isDesktop ? 'auto' : 'none',
          // Sin overflow:hidden a propósito — el contenido interior ya se
          // esconde solo (opacity:0 + translateY fuera de pantalla) cuando
          // está cerrado, así que no hace falta recortarlo contra el alto
          // chico de la franja. Si hubiera overflow:hidden acá, el alto del
          // contenedor cambiaría de golpe (sin transición) al abrir/cerrar y
          // recortaría la animación de deslizamiento del hijo a media carrera.
          display: 'flex', alignItems: 'flex-end',
        }}
      >
        <div
          style={{
            width: '100%', height: `${STRIP_HEIGHT}px`, flexShrink: 0,
            transform: open ? 'translateY(0)' : 'translateY(100%)',
            opacity: open ? 1 : 0,
            transition: 'transform 0.22s cubic-bezier(.2,.8,.2,1), opacity 0.18s ease',
            pointerEvents: open ? 'auto' : 'none',
            background: 'rgba(12,12,12,0.94)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Fila de miniaturas, flanqueada por ‹‹ / ›› para saltar a extremos */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center' }}>
            <button
              onClick={jumpToStart}
              title="Ir a la primera página"
              aria-label="Ir a la primera página"
              style={{
                flexShrink: 0, width: '26px', height: '26px', margin: '0 2px 0 8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
              }}
            >
              <ChevronsLeft size={14} strokeWidth={1.8} />
            </button>

            <div
              ref={stripRef}
              onWheel={handleWheel}
              onPointerDown={handleRowPointerDown}
              onPointerMove={handleRowPointerMove}
              onPointerUp={endRowDrag}
              onPointerLeave={endRowDrag}
              style={{
                flex: 1, minWidth: 0,
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                overflowX: 'auto', scrollbarWidth: 'none',
                padding: '10px 12px',
                cursor: 'grab',
                height: '100%',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)',
                maskImage: 'linear-gradient(to right, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)',
              }}
            >
              {items.map((item, i) => {
                const isActive = i === currentIndex
                return (
                  <button
                    key={item.key}
                    ref={isActive ? activeRef : undefined}
                    onClick={() => handleSelect(i)}
                    style={{
                      flexShrink: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <div style={{
                      height: `${THUMB_H}px`,
                      aspectRatio: `${item.aspectRatio}`,
                      borderRadius: '3px', overflow: 'hidden',
                      boxShadow: isActive ? '0 0 0 2px #E8553A, 0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.35)',
                      opacity: isActive ? 1 : 0.72,
                      transition: 'opacity 0.15s, box-shadow 0.15s',
                      background: '#F9F6F1',
                    }}>
                      {item.render}
                    </div>
                    <span style={{
                      fontSize: '10px', lineHeight: 1,
                      color: isActive ? '#E8553A' : 'rgba(255,255,255,0.4)',
                      fontVariantNumeric: 'tabular-nums',
                      transition: 'color 0.15s',
                    }}>
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              onClick={jumpToEnd}
              title="Ir a la última página"
              aria-label="Ir a la última página"
              style={{
                flexShrink: 0, width: '26px', height: '26px', margin: '0 8px 0 2px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
              }}
            >
              <ChevronsRight size={14} strokeWidth={1.8} />
            </button>
          </div>

          {/* Scrollbar propia — fina, arrastrable de punta a punta, coral al arrastrar */}
          <div
            ref={trackRef}
            onPointerDown={handleTrackPointerDown}
            onPointerMove={handleTrackPointerMove}
            onPointerUp={endTrackDrag}
            style={{
              flexShrink: 0, height: `${TRACK_H}px`,
              margin: '0 20px', position: 'relative',
              display: 'flex', alignItems: 'center',
              cursor: 'pointer', touchAction: 'none',
            }}
          >
            <div style={{ position: 'absolute', left: 0, right: 0, height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{
              position: 'absolute', height: '4px', borderRadius: '2px',
              left: `${thumbLeftPct}%`, width: `${thumbRatio * 100}%`,
              background: barDragging ? '#E8553A' : 'rgba(255,255,255,0.38)',
              transition: barDragging ? 'none' : 'background 0.15s',
            }} />
          </div>
        </div>
      </div>
    </>
  )
}
