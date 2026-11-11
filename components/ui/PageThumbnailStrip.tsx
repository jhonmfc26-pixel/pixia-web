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

const STRIP_HEIGHT = 116
const THUMB_H = 60
const TRACK_H = 16   // alto del área de arrastre (hit-area) de la scrollbar — la barra visible es más fina, dentro de esto

/**
 * Tira de miniaturas para saltar de página — reusable entre el viewer
 * (/book/[id]) y el editor (/edit-v2). No sabe nada de AlbumStructure ni de
 * ViewerSpread: cada caller arma su propia lista de `items` (con SU sistema
 * de navegación real — goTo/currentFold) y esta solo dibuja/gestiona la UI.
 *
 * Se abre y se cierra SOLO con el botón flotante (grid), igual en celular y
 * en computador (decisión de Jhon, 2026-11-10): antes en computador se abría
 * sola con la rueda del mouse o al acercarse al borde, y molestaba. Tocar una
 * miniatura navega; en el celular además la cierra. Escape la cierra.
 *
 * Navegación rápida en álbumes largos: scrollbar horizontal propia (fina,
 * arrastrable de punta a punta, coral mientras se arrastra) además del
 * scroll por rueda/arrastre directo sobre las miniaturas, más botones ‹‹/››
 * para saltar a la primera/última página con un clic.
 */
export default function PageThumbnailStrip({ items, currentIndex, onSelect, bottomBarHeight }: PageThumbnailStripProps) {
  const [isDesktop, setIsDesktop] = useState(true)
  const [open, setOpen] = useState(false)
  const [barDragging, setBarDragging] = useState(false)

  useEffect(() => {
    // Solo en el navegador (en el servidor no hay matchMedia).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Antes servían para que la tira no se ocultara a media interacción; ahora
  // solo se cierra con el botón, así que no hacen nada.
  const holdDrag = useRef(false)
  const reveal = () => {}
  const release = () => {}

  // ── Scroll horizontal de las miniaturas (rueda + arrastre directo) ────────
  const stripRef = useRef<HTMLDivElement>(null)
  const rowDragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null)

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = stripRef.current
    if (!el) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY
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
    if (!isDesktop) setOpen(false)
  }

  const jumpToStart = () => handleSelect(0)
  const jumpToEnd = () => handleSelect(items.length - 1)

  const anchorBottom = `calc(${bottomBarHeight}px + env(safe-area-inset-bottom, 0px))`

  return (
    <>
      {/* Botón que abre y cierra la tira (celular y computador) */}
      {(
        <button
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Cerrar miniaturas' : 'Ver todas las páginas'}
          aria-expanded={open}
          title={open ? 'Cerrar miniaturas' : 'Ver todas las páginas'}
          style={{
            position: 'fixed', right: '16px',
            bottom: `calc(${bottomBarHeight}px + 12px + env(safe-area-inset-bottom, 0px))`,
            width: '40px', height: '40px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: open ? '#E8553A' : 'rgba(20,20,20,0.85)',
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

      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: anchorBottom,
          height: open ? `${STRIP_HEIGHT}px` : '0px',
          zIndex: 130,
          pointerEvents: open ? 'auto' : 'none',
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
                    {/* Ancho y alto explícitos: con aspect-ratio + alto, Safari (iPhone)
                        calculaba el ancho desde el contenido y las miniaturas
                        quedaban muy separadas, una por pantalla. */}
                    <div style={{
                      height: `${THUMB_H}px`,
                      width: `${Math.round(THUMB_H * item.aspectRatio)}px`,
                      position: 'relative',
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
