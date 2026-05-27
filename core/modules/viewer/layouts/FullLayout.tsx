import type { LayoutProps } from '../types'
import { PAGE_BG, BADGE_COLOR, ACT_LABEL } from '../types'

export default function FullLayout({ photos, style, side, caption, showCaption, act }: LayoutProps) {
  const photo = photos[0]
  const bg = PAGE_BG[style]
  const badgeColor = BADGE_COLOR[style]
  const padding = style === 'con-margen' ? '10px' : '0'

  // Left page: full photo
  if (side === 'left') {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', background: bg }}>
        {photo && (
          <div style={{ position: 'absolute', inset: padding, overflow: 'hidden' }}>
            <img src={photo.url} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
        {showCaption && caption && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 16px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}>
            <p style={{ margin: 0, fontSize: 11, fontStyle: 'italic',
              fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.88)', lineHeight: 1.5 }}>
              {caption}
            </p>
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: 10, right: 12,
          fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.2)', pointerEvents: 'none',
        }}>
          {ACT_LABEL[act] ?? act}
        </div>
      </div>
    )
  }

  // Right page: elegant centered divider + act name
  const lineColor   = style === 'con-margen' ? 'rgba(0,0,0,0.08)'  : 'rgba(255,255,255,0.08)'
  const labelColor  = style === 'con-margen' ? 'rgba(0,0,0,0.10)'  : 'rgba(255,255,255,0.10)'
  return (
    <div style={{ width: '100%', height: '100%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 1, background: lineColor }} />
        <span style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: labelColor }}>
          {ACT_LABEL[act] ?? act}
        </span>
        <div style={{ width: 32, height: 1, background: lineColor }} />
      </div>
    </div>
  )
}
