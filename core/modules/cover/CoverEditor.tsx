'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { CoverConfig, PhotoAsset, OccasionType, AlbumFormat } from '@/core/contracts/AlbumBlueprint'
import { getTemplatesForOccasion } from './coverTemplates'
import CoverRenderer from './CoverRenderer'

interface CoverEditorProps {
  config: CoverConfig
  occasion: OccasionType
  format: AlbumFormat
  heroPhotos: PhotoAsset[]
  photoUrl?: string
  photosById: Map<string, PhotoAsset>
  onUpdate: (config: CoverConfig) => void
  onClose: () => void
}

type Tab = 'template' | 'photo' | 'text' | 'position'

export default function CoverEditor({
  config, occasion, format, heroPhotos, photoUrl, photosById, onUpdate, onClose
}: CoverEditorProps) {
  const [tab, setTab] = useState<Tab>('template')
  const templates = getTemplatesForOccasion(occasion)

  const currentPhotoUrl = config.photoId
    ? photosById.get(config.photoId)?.url || photoUrl
    : photoUrl

  const update = (patch: Partial<CoverConfig>) => {
    onUpdate({ ...config, ...patch })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#161616',
          borderRadius: '16px',
          width: '100%', maxWidth: '900px',
          maxHeight: '90vh',
          display: 'flex',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* Preview en vivo */}
        <div style={{
          flex: '0 0 360px',
          background: '#0D0D0D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
        }}>
          <div style={{
            width: '300px', height: '300px',
            borderRadius: '4px',
            overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          }}>
            <CoverRenderer config={config} photoUrl={currentPhotoUrl} scale={0.75} format={format} />
          </div>
        </div>

        {/* Panel de controles */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}>

          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '18px',
              color: 'white',
            }}>
              Editar portada
            </span>
            <button onClick={onClose} style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '22px', cursor: 'pointer', lineHeight: 1,
            }}>×</button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: '4px',
            padding: '12px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            {([
              ['template', 'Diseño'],
              ['photo', 'Foto'],
              ['text', 'Texto'],
              ['position', 'Posición'],
            ] as [Tab, string][]).map(([key, label]) => (
              <button key={key}
                onClick={() => setTab(key)}
                style={{
                  background: tab === key ? 'rgba(232,85,58,0.15)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: tab === key ? '#E8553A' : 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Contenido del tab */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
          }}>

            {/* TAB: Template */}
            {tab === 'template' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              }}>
                {templates.map(t => (
                  <button key={t.id}
                    onClick={() => update({
                      templateId: t.id,
                      textPosition: t.defaultPosition,
                      textAlign: t.defaultAlign,
                    })}
                    style={{
                      background: 'none',
                      border: '2px solid',
                      borderColor: config.templateId === t.id
                        ? '#E8553A' : 'rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      padding: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}>
                    <div style={{
                      width: '100%', aspectRatio: '1',
                      borderRadius: '4px', overflow: 'hidden',
                    }}>
                      <CoverRenderer
                        config={{
                          ...config,
                          templateId: t.id,
                          textPosition: t.defaultPosition,
                          textAlign: t.defaultAlign,
                        }}
                        photoUrl={currentPhotoUrl}
                        scale={0.35}
                        format={format}
                      />
                    </div>
                    <span style={{
                      fontSize: '11px',
                      color: config.templateId === t.id
                        ? '#E8553A' : 'rgba(255,255,255,0.5)',
                      paddingBottom: '4px',
                    }}>
                      {t.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* TAB: Photo */}
            {tab === 'photo' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '8px',
              }}>
                {heroPhotos.map(photo => (
                  <button key={photo.id}
                    onClick={() => update({ photoId: photo.id })}
                    style={{
                      background: 'none',
                      border: '2px solid',
                      borderColor: config.photoId === photo.id
                        ? '#E8553A' : 'transparent',
                      borderRadius: '6px',
                      padding: '2px',
                      cursor: 'pointer',
                      aspectRatio: '1',
                      contentVisibility: 'auto',
                      containIntrinsicSize: '110px 110px',
                      willChange: 'transform',
                      transform: 'translateZ(0)',
                    }}>
                    <img src={photo.thumbnailUrl || photo.url} alt="" loading="lazy" decoding="async"
                      style={{
                        width: '100%', height: '100%',
                        objectFit: 'cover', borderRadius: '4px',
                        display: 'block',
                        transform: 'translateZ(0)',
                        backfaceVisibility: 'hidden',
                      }} />
                  </button>
                ))}
              </div>
            )}

            {/* TAB: Text */}
            {tab === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Título</label>
                  <input
                    value={config.title}
                    onChange={e => update({ title: e.target.value })}
                    style={inputStyle}
                    placeholder="Ej: Juan y Natalia"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Subtítulo</label>
                  <input
                    value={config.subtitle || ''}
                    onChange={e => update({ subtitle: e.target.value })}
                    style={inputStyle}
                    placeholder="Ej: Una historia de amor"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Fecha</label>
                  <input
                    value={config.date || ''}
                    onChange={e => update({ date: e.target.value })}
                    style={inputStyle}
                    placeholder="Ej: Julio 2025"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Color del texto</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['auto', 'light', 'dark'] as const).map(c => (
                      <button key={c}
                        onClick={() => update({ textColor: c })}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: config.textColor === c
                            ? '#E8553A' : 'rgba(255,255,255,0.1)',
                          background: config.textColor === c
                            ? 'rgba(232,85,58,0.12)' : 'transparent',
                          color: config.textColor === c
                            ? '#E8553A' : 'rgba(255,255,255,0.5)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}>
                        {c === 'auto' ? 'Auto' : c === 'light' ? 'Claro' : 'Oscuro'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Position */}
            {tab === 'position' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Posición vertical</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['top', 'center', 'bottom'] as const).map(p => (
                      <button key={p}
                        onClick={() => update({ textPosition: p })}
                        style={{
                          flex: 1, padding: '8px', borderRadius: '6px',
                          border: '1px solid',
                          borderColor: config.textPosition === p
                            ? '#E8553A' : 'rgba(255,255,255,0.1)',
                          background: config.textPosition === p
                            ? 'rgba(232,85,58,0.12)' : 'transparent',
                          color: config.textPosition === p
                            ? '#E8553A' : 'rgba(255,255,255,0.5)',
                          fontSize: '12px', cursor: 'pointer',
                        }}>
                        {p === 'top' ? 'Arriba' : p === 'center' ? 'Centro' : 'Abajo'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Alineación</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['left', 'center', 'right'] as const).map(a => (
                      <button key={a}
                        onClick={() => update({ textAlign: a })}
                        style={{
                          flex: 1, padding: '8px', borderRadius: '6px',
                          border: '1px solid',
                          borderColor: config.textAlign === a
                            ? '#E8553A' : 'rgba(255,255,255,0.1)',
                          background: config.textAlign === a
                            ? 'rgba(232,85,58,0.12)' : 'transparent',
                          color: config.textAlign === a
                            ? '#E8553A' : 'rgba(255,255,255,0.5)',
                          fontSize: '12px', cursor: 'pointer',
                        }}>
                        {a === 'left' ? 'Izq' : a === 'center' ? 'Centro' : 'Der'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <button onClick={onClose} style={{
              width: '100%',
              padding: '12px',
              background: '#E8553A',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}>
              Listo
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: '6px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px',
  color: 'white',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
}
