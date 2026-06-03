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
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header — fijo */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{
              width: '60px', height: '60px',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '2px solid #E8553A',
              flexShrink: 0,
            }}>
              <img
                src={currentPhoto.thumbnailUrl || currentPhoto.url}
                alt=""
                loading="eager"
                width={60}
                height={60}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                Reemplazar foto
              </div>
              <div style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '17px',
                color: 'white',
                marginTop: '2px',
              }}>
                Elige una alternativa
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '22px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '4px 8px',
            }}
          >×</button>
        </div>

        {/* Contenido scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {candidates.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '13px',
            }}>
              No hay otras fotos disponibles para reemplazar.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '10px',
            }}>
              {candidates.map(photo => (
                <button
                  key={photo.id}
                  onClick={() => onPick(photo)}
                  style={{
                    background: 'none',
                    border: '2px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: 0,
                    cursor: 'pointer',
                    aspectRatio: '1',
                    overflow: 'hidden',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#E8553A'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                >
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={140}
                    height={140}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
