'use client'
import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'

interface PhotoReplaceModalProps {
  currentPhoto: PhotoAsset
  candidates: PhotoAsset[]
  onPick: (newPhoto: PhotoAsset) => void
  onClose: () => void
}

export default function PhotoReplaceModal({
  currentPhoto, candidates, onPick, onClose,
}: PhotoReplaceModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#161616',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '900px',
          width: '100%',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Reemplazar foto
            </div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', color: 'white', marginTop: '4px' }}>
              Elige una alternativa
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            fontSize: '22px', cursor: 'pointer', lineHeight: 1,
          }}>×</button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            Actual
          </div>
          <div style={{ width: '140px', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '2px solid #E8553A' }}>
            <img src={currentPhoto.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        </div>

        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          Alternativas
        </div>
        {candidates.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            No hay otras fotos disponibles para reemplazar.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {candidates.map(photo => (
              <button
                key={photo.id}
                onClick={() => onPick(photo)}
                style={{
                  background: 'none',
                  border: '2px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: 0,
                  cursor: 'pointer',
                  aspectRatio: '1',
                  overflow: 'hidden',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#E8553A'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
