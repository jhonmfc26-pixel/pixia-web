'use client'
import type { CoverConfig } from '@/core/contracts/AlbumBlueprint'
import { getTemplateById } from './coverTemplates'

interface CoverRendererProps {
  config: CoverConfig
  photoUrl?: string
  scale?: number
  format?: '20x20' | '30x30' | 'a4'
}

export default function CoverRenderer({ config, photoUrl, scale = 1, format = '30x30' }: CoverRendererProps) {
  const aspectRatio = format === 'a4' ? '3 / 4' : '1 / 1'
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
    }}>
      {photoUrl && (
        <img
          src={photoUrl}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
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
        padding: `${28 * scale}px ${24 * scale}px`,
        textAlign: config.textAlign,
      }}>
        <h1 style={{
          fontFamily: `'${template.titleFont}', serif`,
          fontSize: `${template.titleSize * scale}px`,
          fontWeight: template.titleWeight,
          color: textColor,
          letterSpacing: template.letterSpacing,
          margin: 0,
          lineHeight: 1.1,
          textShadow: `0 2px 12px ${shadowColor}`,
        }}>
          {config.title}
        </h1>

        {template.showDivider && config.subtitle && (
          <div style={{
            width: `${40 * scale}px`,
            height: '1px',
            background: textColor,
            opacity: 0.5,
            margin: `${10 * scale}px 0`,
          }} />
        )}

        {config.subtitle && (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: `${template.subtitleSize * scale}px`,
            color: textColor,
            opacity: 0.85,
            margin: `${6 * scale}px 0 0 0`,
            fontWeight: 300,
            letterSpacing: '0.05em',
          }}>
            {config.subtitle}
          </p>
        )}

        {config.date && (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: `${(template.subtitleSize - 1) * scale}px`,
            color: textColor,
            opacity: 0.6,
            margin: `${4 * scale}px 0 0 0`,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            {config.date}
          </p>
        )}
      </div>
    </div>
  )
}
