import type { LayoutProps } from '../types'
import { ACT_LABEL } from '../types'

// Portrait layout always uses margin regardless of album style
export default function PortraitLayout({ photos, side, act }: LayoutProps) {
  if (side === 'left') {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {photos[0] && (
          <div style={{
            position: 'absolute',
            inset: '18%',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          }}>
            <img src={photos[0].url} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
      </div>
    )
  }

  // Right: clean page with centered act badge
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        fontSize: 10,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'rgba(0,0,0,0.15)',
      }}>
        {ACT_LABEL[act] ?? act}
      </div>
    </div>
  )
}
