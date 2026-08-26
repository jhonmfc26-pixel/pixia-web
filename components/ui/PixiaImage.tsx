'use client'

import { useEffect, useRef, useState, type ImgHTMLAttributes, type CSSProperties } from 'react'

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 600

/**
 * Placeholder de foto rota — papel crema + ícono line-art discreto, NUNCA el
 * ícono roto del navegador. Ocupa el mismo espacio que ocuparía la <img>
 * (mismo width/height/style del slot que se le pase), así que no rompe el
 * layout del pliego/grid que la contiene.
 */
function BrokenImagePlaceholder({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #EDEBE6, #E2DFD8)',
        ...style,
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" style={{ width: '26%', height: '26%', maxWidth: 40, maxHeight: 40, opacity: 0.3, flexShrink: 0 }}>
        <rect x="2" y="4" width="20" height="16" rx="2" stroke="#5c564a" strokeWidth="1.4" />
        <circle cx="8" cy="10" r="1.6" stroke="#5c564a" strokeWidth="1.4" />
        <path d="M3 17l5.5-5.5a1.5 1.5 0 0 1 2.12 0L15 16m3-3l1.5-1.5a1.5 1.5 0 0 1 2.12 0L22.5 12.5"
          stroke="#5c564a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

interface PixiaImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'src'> {
  /** Igual que <img src>, pero acepta undefined/'' (foto sin URL) — se trata como fallo directo, sin reintentar. */
  src: string | undefined
}

/**
 * Reemplazo de <img> para fotos de usuario (R2/CDN) — si la carga falla,
 * reintenta un par de veces (muchos fallos de CDN son momentáneos) y si
 * sigue fallando muestra BrokenImagePlaceholder en vez del ícono roto del
 * navegador. Drop-in: acepta los mismos props que <img> (style, className,
 * draggable, etc.) y los pasa tal cual — object-fit/object-position y demás
 * estilos de cada caller no cambian.
 */
export default function PixiaImage({ src, style, className, alt = '', ...rest }: PixiaImageProps) {
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Foto nueva (src cambió, ej. al reemplazar o reordenar) — arrancar limpio.
  useEffect(() => {
    setAttempt(0)
    setFailed(false)
  }, [src])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  if (!src || failed) {
    return <BrokenImagePlaceholder className={className} style={style} />
  }

  // Cache-bust en cada reintento — si no, el navegador puede reusar la
  // misma respuesta fallida en vez de pedirla de nuevo al CDN.
  const resolvedSrc = attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}_retry=${attempt}`

  return (
    <img
      {...rest}
      alt={alt}
      src={resolvedSrc}
      style={style}
      className={className}
      onError={() => {
        if (attempt < MAX_RETRIES) {
          timerRef.current = setTimeout(() => setAttempt(a => a + 1), RETRY_DELAY_MS)
        } else {
          setFailed(true)
        }
      }}
    />
  )
}
