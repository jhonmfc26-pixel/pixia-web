'use client'
import type { CoverConfig } from '@/core/contracts/AlbumBlueprint'
import { getTemplateById, fitTitleSize } from './coverTemplates'
import { manualCoverStyle, aspectOf } from '@/core/modules/viewer/manualCover'

interface CoverRendererProps {
  config: CoverConfig
  photoUrl?: string
  /**
   * Dimensiones reales de la foto — opcionales, solo para calcular el
   * recorte manual (ver manualCover.ts) y evitar el bloat de Chromium al
   * exportar a PDF. Sin esto (ej. CoverEditor, que no las pasa) cae de
   * vuelta a object-fit:cover normal — mismo visual, sin el fix de peso
   * (no importa en el editor, no se exporta a PDF).
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

export default function CoverRenderer({ config, photoUrl, photoWidth, photoHeight, format = '30x30', panelAspect }: CoverRendererProps) {
  const containerAspect = panelAspect ?? (format === 'a4' ? 3 / 4 : 1)
  const aspectRatio = String(containerAspect)
  const template = getTemplateById(config.templateId)
  if (!template) return null

  const textColor = config.textColor === 'light' ? '#FFFFFF'
    : config.textColor === 'dark' ? '#1a1a1a'
    : '#FFFFFF'

  const shadowColor = textColor === '#FFFFFF'
    ? 'rgba(0,0,0,0.4)'
    : 'rgba(255,255,255,0.3)'

  const overlay = (() => {
    switch (template.overlayStyle) {
      case 'gradient-bottom':
        // La sombra va detrás del texto: si el cliente lo sube, la sombra sube con él.
        if (config.textPosition === 'top') return 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 45%, transparent 70%)'
        if (config.textPosition === 'center') return 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 60%, transparent 85%)'
        return 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 45%, transparent 70%)'
      case 'gradient-full':
        return 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 100%)'
      case 'dark-vignette':
        return 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)'
      default:
        return 'none'
    }
  })()

  const justifyContent = config.textPosition === 'top' ? 'flex-start'
    : config.textPosition === 'center' ? 'center'
    : 'flex-end'

  const alignItems = config.textAlign === 'left' ? 'flex-start'
    : config.textAlign === 'right' ? 'flex-end'
    : 'center'

  return (
    <div style={{
      width: '100%',
      aspectRatio,
      position: 'relative',
      overflow: 'hidden',
      background: '#1a1a1a',
      // Container query: todo el texto de acá abajo usa unidades `cqw` (% del
      // ancho de ESTE div) en vez de px fijos — así el tamaño es proporcional
      // a la página tanto en el viewer (~500-700px en pantalla) como en el
      // PDF (~300mm físicos vía Puppeteer/Playwright) sin necesitar un prop
      // `scale` manual por caller (lo que había antes, y por lo que portada
      // se veía más chica en el PDF: cada caller pasaba —o no— un scale
      // distinto sin relación real con su tamaño físico).
      containerType: 'inline-size',
    }}>
      {photoUrl && (
        <img
          src={photoUrl}
          alt=""
          style={manualCoverStyle(aspectOf(photoWidth, photoHeight), containerAspect, 'center center')}
        />
      )}

      {overlay !== 'none' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: overlay,
        }} />
      )}

      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent,
        alignItems,
        padding: '6cqw 5cqw',
        textAlign: config.textAlign,
      }}>
        <h1 style={{
          fontFamily: `'${template.titleFont}', serif`,
          // Achica el título si la palabra más larga no cabe (ver fitTitleSize).
          fontSize: `${fitTitleSize(config.title, template)}cqw`,
          fontWeight: template.titleWeight,
          color: textColor,
          letterSpacing: template.letterSpacing,
          margin: 0,
          lineHeight: 1.05,
          textShadow: `0 2px 12px ${shadowColor}`,
          // Sin esto, con align-items != 'stretch' (siempre acá, ver arriba)
          // el h1 se ajusta a su ancho de contenido en vez del de la página —
          // un título largo puede desbordar el overflow:hidden del contenedor
          // en vez de partir en líneas. Con el tamaño más grande de este fix
          // es más fácil de gatillar, así que se cubre explícito.
          width: '100%',
          maxWidth: '100%',
          // Solo como último recurso (palabras absurdamente largas): el tamaño
          // ya se ajustó para que las palabras normales quepan enteras.
          overflowWrap: 'break-word',
        }}>
          {config.title}
        </h1>

        {template.showDivider && config.subtitle && (
          <div style={{
            width: '10cqw',
            height: '1px',
            background: textColor,
            opacity: 0.5,
            margin: '2cqw 0',
          }} />
        )}

        {config.subtitle && (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: `${template.subtitleSize}cqw`,
            color: textColor,
            opacity: 0.85,
            margin: '1.4cqw 0 0 0',
            fontWeight: 300,
            letterSpacing: '0.05em',
            width: '100%',
            maxWidth: '100%',
            overflowWrap: 'break-word',
          }}>
            {config.subtitle}
          </p>
        )}

        {config.date && (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: `${template.subtitleSize - 0.4}cqw`,
            color: textColor,
            opacity: 0.6,
            margin: '0.9cqw 0 0 0',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            width: '100%',
            maxWidth: '100%',
            overflowWrap: 'break-word',
          }}>
            {config.date}
          </p>
        )}
      </div>
    </div>
  )
}
