'use client'
import type { CSSProperties } from 'react'
import type { CoverConfig } from '@/core/contracts/AlbumBlueprint'
import { resolveCover, type ResolvedCover } from './coverDesign'
import { CoverArtSvg } from './coverArt'
import { manualCoverStyle, aspectOf } from '@/core/modules/viewer/manualCover'

interface CoverRendererProps {
  config: CoverConfig
  photoUrl?: string
  /** Si photoUrl (versión liviana del visor) no carga, se usa esta (la original). */
  photoFallbackUrl?: string
  /**
   * Dimensiones reales de la foto — opcionales, solo para calcular el
   * recorte manual (ver manualCover.ts) y evitar el bloat de Chromium al
   * exportar a PDF. Sin esto cae de vuelta a object-fit:cover normal.
   */
  photoWidth?: number
  photoHeight?: number
  format?: '20x20' | '30x30' | 'a4'
  /**
   * Solo impresión: proporción exacta del panel de la cubierta (con sangrado)
   * para que la foto cubra también el sangrado. Sin esto, la proporción del formato.
   */
  panelAspect?: number
}

/**
 * La portada. Una sola implementación para el visor, el editor, el estudio,
 * el paso 3 y el PDF (vía PrintCoverWrap). Todo el tamaño va en cqw (% del
 * ancho de la portada), así se ve igual a 80 px en una miniatura y a 300 mm
 * impresa.
 *
 * Dos tipos (ver coverDesign.ts):
 *  - foto a sangre con el título encima (todas las de antes);
 *  - gráfica: fondo de color, ilustración propia y título grande, sin foto.
 */
export default function CoverRenderer({ config, photoUrl, photoFallbackUrl, photoWidth, photoHeight, format = '30x30', panelAspect }: CoverRendererProps) {
  const containerAspect = panelAspect ?? (format === 'a4' ? 3 / 4 : 1)
  const r = resolveCover(config)

  const root: CSSProperties = {
    width: '100%',
    aspectRatio: String(containerAspect),
    position: 'relative',
    overflow: 'hidden',
    background: r.kind === 'graphic' ? r.bg : '#1a1a1a',
    containerType: 'inline-size',
  }

  if (r.kind === 'graphic') {
    return <div style={root}><GraphicCover r={r} config={config} aspect={containerAspect} /></div>
  }

  const shadowColor = isLight(r.fg) ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.3)'
  const overlay = photoOverlay(r)

  return (
    <div style={root}>
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" style={manualCoverStyle(aspectOf(photoWidth, photoHeight), containerAspect, 'center center')}
          onError={photoFallbackUrl && photoFallbackUrl !== photoUrl ? (e) => {
            const img = e.currentTarget
            if (img.src !== photoFallbackUrl) img.src = photoFallbackUrl
          } : undefined} />
      )}
      {overlay !== 'none' && <div style={{ position: 'absolute', inset: 0, background: overlay }} />}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        justifyContent: r.position === 'top' ? 'flex-start' : r.position === 'center' ? 'center' : 'flex-end',
        alignItems: r.align === 'left' ? 'flex-start' : r.align === 'right' ? 'flex-end' : 'center',
        padding: '6cqw 5cqw', textAlign: r.align,
      }}>
        <Title r={r} text={config.title} shadow={`0 2px 12px ${shadowColor}`} />
        {r.showDivider && config.subtitle && <Divider color={r.fg} />}
        <Lines r={r} config={config} />
      </div>
    </div>
  )
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150
}

function photoOverlay(r: ResolvedCover): string {
  // Texto oscuro sobre foto: la sombra va clara, no negra.
  const tint = isLight(r.fg) ? '0,0,0' : '255,255,255'
  switch (r.overlay) {
    case 'gradient-bottom':
      // La sombra va detrás del texto: si el cliente lo sube, la sombra sube con él.
      if (r.position === 'top') return `linear-gradient(to bottom, rgba(${tint},0.7) 0%, rgba(${tint},0.1) 45%, transparent 70%)`
      if (r.position === 'center') return `radial-gradient(ellipse at center, rgba(${tint},0.45) 0%, rgba(${tint},0.15) 60%, transparent 85%)`
      return `linear-gradient(to top, rgba(${tint},0.7) 0%, rgba(${tint},0.1) 45%, transparent 70%)`
    case 'gradient-full':
      return `linear-gradient(to top, rgba(${tint},0.6) 0%, rgba(${tint},0.2) 100%)`
    case 'dark-vignette':
      return `radial-gradient(ellipse at center, transparent 30%, rgba(${tint},0.5) 100%)`
    default:
      return 'none'
  }
}

function Title({ r, text, shadow }: { r: ResolvedCover; text: string; shadow?: string }) {
  return (
    <h1 style={{
      fontFamily: `'${r.font.family}', ${r.font.fallback}`,
      fontSize: `${r.titleSize}cqw`,
      fontWeight: r.font.weight,
      letterSpacing: r.font.letterSpacing,
      textTransform: r.font.uppercase ? 'uppercase' : 'none',
      color: r.fg,
      margin: 0,
      lineHeight: r.font.uppercase ? 0.98 : 1.05,
      textShadow: shadow,
      // Sin width:100% el h1 se ajusta a su contenido y un título largo
      // desborda en vez de partir en líneas.
      width: '100%',
      maxWidth: '100%',
      overflowWrap: 'break-word',
    }}>
      {text}
    </h1>
  )
}

function Divider({ color }: { color: string }) {
  return <div style={{ width: '10cqw', height: '1px', background: color, opacity: 0.5, margin: '2cqw 0' }} />
}

function Lines({ r, config }: { r: ResolvedCover; config: CoverConfig }) {
  const common: CSSProperties = {
    fontFamily: "'Inter', sans-serif", color: r.fg, width: '100%', maxWidth: '100%', overflowWrap: 'break-word',
  }
  return (
    <>
      {config.subtitle && (
        <p style={{ ...common, fontSize: `${r.subtitleSize}cqw`, opacity: 0.85, margin: '1.4cqw 0 0 0', fontWeight: 300, letterSpacing: '0.05em' }}>
          {config.subtitle}
        </p>
      )}
      {config.date && (
        <p style={{ ...common, fontSize: `${r.subtitleSize - 0.4}cqw`, opacity: 0.6, margin: '0.9cqw 0 0 0', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {config.date}
        </p>
      )}
    </>
  )
}

/**
 * Tapa gráfica. Composiciones:
 *  - poster: título grande arriba (o abajo), la ilustración ocupa el resto,
 *    nombres y fecha al pie — estilo cartel de viaje.
 *  - centered: ilustración mediana al centro y el título debajo (o encima).
 *  - framed: marco fino, ilustración pequeña, título centrado.
 */
function GraphicCover({ r, config, aspect }: { r: ResolvedCover; config: CoverConfig; aspect: number }) {
  const colors = { fg: r.fg, accent: r.accent, bg: r.bg }
  const titleFirst = r.position === 'top'
  const textBlock = (
    <div style={{ width: '100%', textAlign: r.align, display: 'flex', flexDirection: 'column', alignItems: r.align === 'left' ? 'flex-start' : r.align === 'right' ? 'flex-end' : 'center' }}>
      <Title r={r} text={config.title} />
      {r.showDivider && config.subtitle && <Divider color={r.fg} />}
      <Lines r={r} config={config} />
    </div>
  )
  // Alto disponible para el dibujo en cqw (la portada mide 100/aspect cqw de alto).
  const heightCqw = 100 / aspect

  // Dibujo: el arte del catálogo (imagen) o una ilustración propia (SVG).
  // La imagen va con max-width/max-height y no con object-fit: así Chromium
  // conserva el PNG/JPG original en el PDF (ver manualCover.ts).
  const artBox = (style: CSSProperties) => r.artUrl
    ? (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={r.artUrl} alt="" style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }} />
      </div>
    )
    : r.artId ? <CoverArtSvg id={r.artId} colors={colors} style={style} /> : null

  if (r.layout === 'full') {
    // Arte de tapa completa (lo entrega el diseñador con espacio para el título).
    return (
      <>
        {r.artUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.artUrl} alt="" style={manualCoverStyle(r.artAspect ?? aspect, aspect, 'center center')} />
        )}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          justifyContent: r.position === 'top' ? 'flex-start' : r.position === 'center' ? 'center' : 'flex-end',
          padding: '7cqw 6cqw', boxSizing: 'border-box',
        }}>
          {textBlock}
        </div>
      </>
    )
  }

  if (r.layout === 'framed') {
    return (
      <div style={{ position: 'absolute', inset: '5cqw', border: `0.35cqw solid ${r.fg}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4cqw', padding: '6cqw 6cqw', boxSizing: 'border-box' }}>
        <div style={{ position: 'absolute', inset: '1.6cqw', border: `0.15cqw solid ${r.fg}`, opacity: 0.45, pointerEvents: 'none' }} />
        {artBox({ width: '30cqw', height: '30cqw' })}
        {textBlock}
      </div>
    )
  }

  if (r.layout === 'centered') {
    const art = artBox({ width: '52cqw', height: `${Math.min(52, heightCqw * 0.5)}cqw` })
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5cqw', padding: '8cqw 7cqw', boxSizing: 'border-box' }}>
        {titleFirst ? <>{textBlock}{art}</> : <>{art}{textBlock}</>}
      </div>
    )
  }

  // poster
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '7cqw 6cqw 6cqw', boxSizing: 'border-box', gap: '3cqw' }}>
      {titleFirst && textBlock}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {artBox({ width: '100%', height: '100%', maxWidth: r.artUrl ? '88cqw' : '80cqw' })}
      </div>
      {!titleFirst && textBlock}
    </div>
  )
}
