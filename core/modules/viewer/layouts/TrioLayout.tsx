import type { LayoutProps } from '../types'
import { PAGE_BG, BADGE_COLOR, ACT_LABEL } from '../types'

export default function TrioLayout({ photos, style, side, caption, showCaption, act }: LayoutProps) {
  const bg = PAGE_BG[style]
  const badgeColor = BADGE_COLOR[style]
  const gap = style === 'sin-margen' ? '2px' : '6px'
  const pad = style === 'con-margen' ? '8px' : '0'

  if (side === 'left') {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', background: bg, display: 'flex', flexDirection: 'column', gap, padding: pad, boxSizing: 'border-box' }}>
        {/* Top 65% */}
        <div style={{ flex: '0 0 65%', overflow: 'hidden', position: 'relative' }}>
          {photos[0] && (
            <img src={photos[0].url} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
        </div>
        {/* Bottom 35% */}
        <div style={{ flex: '1', overflow: 'hidden', position: 'relative' }}>
          {photos[1] && (
            <img src={photos[1].url} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
        </div>
        <div style={{
          position: 'absolute', bottom: 10, right: 12,
          fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: badgeColor, pointerEvents: 'none',
        }}>
          {ACT_LABEL[act] ?? act}
        </div>
      </div>
    )
  }

  // Right: photos[2] full page
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: bg }}>
      <div style={{ position: 'absolute', inset: pad, overflow: 'hidden' }}>
        {photos[2] && (
          <img src={photos[2].url} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
      </div>
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
        color: badgeColor, pointerEvents: 'none',
      }}>
        {ACT_LABEL[act] ?? act}
      </div>
    </div>
  )
}
