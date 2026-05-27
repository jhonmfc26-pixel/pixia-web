import type { LayoutProps } from '../types'

export default function DuoHLayout({ photos, style, side, caption, showCaption, act }: LayoutProps) {
  const bg = style === 'con-margen' ? '#FAFAF8' : '#0f0f0f'
  const badgeColor = style === 'con-margen' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'
  const margin = style === 'con-margen' ? '8px' : '0px'
  const gap = style === 'con-margen' ? '3px' : '0px'

  console.log('[DuoH]', side, photos.length, photos.map(p => p.id))

  if (side === 'right') {
    return (
      <div style={{
        width: '100%', height: '100%', background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: badgeColor }}>
          {act}
        </span>
      </div>
    )
  }

  // side === 'left': two stacked photos
  return (
    <div style={{
      width: '100%', height: '100%', background: bg,
      display: 'flex', flexDirection: 'column',
      padding: margin, gap, boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* Top photo */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: style === 'con-margen' ? 2 : 0 }}>
        {photos[0] && (
          <img src={photos[0].url} alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
      </div>

      {/* Bottom photo */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: style === 'con-margen' ? 2 : 0 }}>
        {photos[1] ? (
          <img src={photos[1].url} alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: bg }} />
        )}
      </div>

      {showCaption && caption && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '12px 16px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
          fontFamily: 'Playfair Display, serif', fontSize: 11,
          fontStyle: 'italic', color: 'rgba(255,255,255,0.88)',
          pointerEvents: 'none',
        }}>
          {caption}
        </div>
      )}
    </div>
  )
}
