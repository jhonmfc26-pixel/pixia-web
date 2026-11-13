'use client'
import { useRef, useState, type ReactNode } from 'react'

/**
 * Envuelve una portada (CoverRenderer) y deja arrastrar su bloque de texto
 * (el elemento con `data-cover-text`). Entrega la posición como el centro del
 * bloque en % de la portada, que es lo que guarda CoverConfig.textX/textY y
 * lo que dibuja igual el visor y el PDF.
 *
 * Imán al centro horizontal (±3 %) para que sea fácil dejarlo centrado.
 */
export default function DraggableCoverText({ enabled, onMove, children }: {
  enabled: boolean
  onMove: (x: number, y: number) => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [hover, setHover] = useState(false)

  /** Rectángulo real del texto (la capa puede ocupar toda la portada). */
  const textRect = (layer: Element) => {
    const kids = [...layer.children].map(k => k.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0)
    if (!kids.length) return null
    const left = Math.min(...kids.map(r => r.left)), right = Math.max(...kids.map(r => r.right))
    const top = Math.min(...kids.map(r => r.top)), bottom = Math.max(...kids.map(r => r.bottom))
    return { left, right, top, bottom }
  }
  const hit = (e: React.PointerEvent) => {
    const layer = ref.current?.querySelector('[data-cover-text]')
    const r = layer && textRect(layer)
    if (!r) return null
    const pad = 10
    return e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad ? r : null
  }

  return (
    <div
      ref={ref}
      style={{ position: 'relative', touchAction: enabled ? 'none' : undefined, cursor: enabled ? (dragging ? 'grabbing' : hover ? 'grab' : 'default') : undefined }}
      onPointerDown={e => {
        if (!enabled) return
        const r = hit(e)
        if (!r) return
        drag.current = { dx: e.clientX - (r.left + r.right) / 2, dy: e.clientY - (r.top + r.bottom) / 2 }
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragging(true)
        e.preventDefault()
      }}
      onPointerMove={e => {
        if (!enabled) return
        if (!drag.current) { setHover(!!hit(e)); return }
        const box = ref.current!.getBoundingClientRect()
        let x = ((e.clientX - drag.current.dx - box.left) / box.width) * 100
        let y = ((e.clientY - drag.current.dy - box.top) / box.height) * 100
        if (Math.abs(x - 50) < 3) x = 50
        x = Math.max(8, Math.min(92, x))
        y = Math.max(6, Math.min(94, y))
        onMove(Math.round(x * 10) / 10, Math.round(y * 10) / 10)
      }}
      onPointerUp={() => { drag.current = null; setDragging(false) }}
      onPointerCancel={() => { drag.current = null; setDragging(false) }}
      onPointerLeave={() => setHover(false)}
    >
      {children}
      {enabled && (dragging || hover) && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', outline: '1px dashed rgba(232,85,58,0.8)', outlineOffset: '-1px' }} />
      )}
      {dragging && (
        <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 0, borderLeft: '1px dashed rgba(232,85,58,0.6)', pointerEvents: 'none' }} />
      )}
    </div>
  )
}
