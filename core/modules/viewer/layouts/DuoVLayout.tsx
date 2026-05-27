import type { LayoutProps } from '../types'
import { PAGE_BG, BADGE_COLOR, ACT_LABEL } from '../types'

export default function DuoVLayout({ photos, style, side, caption, showCaption, act }: LayoutProps) {
  const photo = side === 'left' ? photos[0] : photos[1]
  const bg = PAGE_BG[style]
  const badgeColor = BADGE_COLOR[style]
  const padding = style === 'con-margen' ? '8px' : '0'

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: bg }}>
      {photo && (
        <div style={{ position: 'absolute', inset: padding, overflow: 'hidden' }}>
          <img src={photo.url} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
      {side === 'right' && showCaption && caption && (
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
