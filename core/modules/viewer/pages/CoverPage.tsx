import type { PhotoAsset, CoverConfig, AlbumStyle } from '@/core/contracts/AlbumBlueprint'

interface CoverPageProps {
  photo?: PhotoAsset
  cover: CoverConfig
  style: AlbumStyle
}

export default function CoverPage({ photo, cover }: CoverPageProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#1a1a1a' }}>
      {photo && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <img src={photo.url} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
      {/* Overlay gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
        pointerEvents: 'none',
      }} />
      {/* Title block */}
      <div style={{
        position: 'absolute', bottom: 36, left: 28,
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        <p style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(18px, 3vw, 28px)',
          fontWeight: 400,
          color: 'white',
          letterSpacing: '0.04em',
          lineHeight: 1.25,
        }}>
          {cover.title}
        </p>
        {cover.subtitle && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.65)',
            fontFamily: 'var(--font-display)', fontWeight: 300, lineHeight: 1.4 }}>
            {cover.subtitle}
          </p>
        )}
        {cover.date && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.1em', fontFamily: 'system-ui, sans-serif' }}>
            {cover.date}
          </p>
        )}
      </div>
    </div>
  )
}
