'use client'
import { Crop, LayoutGrid, RefreshCw, Star, Trash2 } from 'lucide-react'
import { LAYOUTS } from '@/core/modules/album/layouts/registry'
import type { Face } from '../types'
import type { SelState } from './selectionTypes'

// ── Acciones de foto ──────────────────────────────────────────────────────────

const PHOTO_ACTIONS = [
  { id: 'reframe',   label: 'Reencuadrar', Icon: Crop      },
  { id: 'replace',   label: 'Cambiar',     Icon: RefreshCw },
  { id: 'highlight', label: 'Destacar',    Icon: Star      },
  { id: 'remove',    label: 'Quitar',      Icon: Trash2    },
] as const

// ── Thumbnail de layout (mini CSS grid) ───────────────────────────────────────

function LayoutThumb({ layoutId, isActive, onClick }: {
  layoutId: string
  isActive: boolean
  onClick: () => void
}) {
  const schema = LAYOUTS.find(l => l.id === layoutId)
  if (!schema) return null
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '5px', padding: '6px 8px', border: 'none', flexShrink: 0,
        borderRadius: '8px', cursor: 'pointer',
        background: isActive ? 'rgba(232,85,58,0.12)' : 'transparent',
        boxShadow: isActive ? 'inset 0 0 0 1.5px #E8553A' : 'inset 0 0 0 1.5px transparent',
        transition: 'background 0.12s, box-shadow 0.12s',
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: schema.grid.columns,
        gridTemplateRows: schema.grid.rows,
        gridTemplateAreas: schema.grid.areas,
        gap: '2px', width: '52px', height: '40px',
        background: schema.hasAir ? 'rgba(249,246,241,0.12)' : undefined,
      }}>
        {schema.slots.map(slot => (
          <div key={slot} style={{
            gridArea: slot, borderRadius: '1px',
            background: isActive ? '#E8553A' : 'rgba(255,255,255,0.2)',
            transition: 'background 0.12s',
          }} />
        ))}
      </div>
      <span style={{
        fontSize: '9px', textAlign: 'center', lineHeight: 1.2,
        maxWidth: '68px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        color: isActive ? '#E8553A' : 'rgba(255,255,255,0.4)',
        transition: 'color 0.12s',
      }}>
        {schema.name}
      </span>
    </button>
  )
}

// ── Barra contextual ──────────────────────────────────────────────────────────

interface ContextBarProps {
  sel: SelState
  selectedFace: Face | null
  /** Cara que contiene la foto seleccionada; permite abrir el selector de layout desde modo foto. */
  photoFace?: Face | null
  onAction: (action: string, id: string) => void
}

export default function ContextBar({ sel, selectedFace, photoFace, onAction }: ContextBarProps) {
  const isVisible = sel !== null

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: '64px',
      height: '112px',
      background: '#161616',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '14px 14px 0 0',
      zIndex: 50,
      transform: isVisible ? 'translateY(0)' : 'translateY(200px)',
      transition: 'transform 0.26s cubic-bezier(0.4, 0, 0.2, 1)',
      willChange: 'transform',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      {/* Pill drag-indicator */}
      <div style={{
        position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
        width: '32px', height: '3px', borderRadius: '2px',
        background: 'rgba(255,255,255,0.12)',
      }} />

      {/* ── MODO FOTO ──────────────────────────────────────────────────────── */}
      {sel?.type === 'photo' && (
        <div style={{ padding: '14px 20px 12px', display: 'flex', alignItems: 'stretch' }}>

          {/* Zona: Foto */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{
              fontSize: '10px', letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.28)', lineHeight: 1,
            }}>Foto</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {PHOTO_ACTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => onAction(id, sel.id)}
                  style={{
                    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '5px', padding: '8px 2px', border: 'none', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.65)',
                    cursor: 'pointer', transition: 'color 0.12s, background 0.12s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#E8553A'
                    e.currentTarget.style.background = 'rgba(232,85,58,0.08)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  }}
                >
                  <Icon size={18} strokeWidth={1.5} />
                  <span style={{ fontSize: '10px', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Separador vertical + zona Página — solo si hay cara contenedora */}
          {photoFace && (
            <>
              <div style={{
                width: '1px', flexShrink: 0, margin: '0 14px',
                background: 'rgba(255,255,255,0.12)',
              }} />

              {/* Zona: Página */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <span style={{
                  fontSize: '10px', letterSpacing: '0.07em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.28)', lineHeight: 1,
                }}>Página</span>
                <button
                  onClick={() => onAction('select-face', photoFace.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '5px', padding: '8px 18px', border: 'none', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.55)',
                    cursor: 'pointer', transition: 'color 0.12s, background 0.12s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#E8553A'
                    e.currentTarget.style.background = 'rgba(232,85,58,0.08)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  }}
                >
                  <LayoutGrid size={18} strokeWidth={1.5} />
                  <span style={{ fontSize: '10px', lineHeight: 1 }}>Diseño</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODO CARA ──────────────────────────────────────────────────────── */}
      {sel?.type === 'face' && selectedFace && (
        selectedFace.isEmpty ? (
          /* Cara vacía: hueco de edición — botón para abrir la bolsa */
          <div style={{ padding: '14px 20px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '11px', letterSpacing: '0.04em',
              color: 'rgba(255,255,255,0.38)',
            }}>
              Página vacía
            </div>
            <button
              onClick={() => onAction('open-bag', selectedFace.id)}
              style={{
                alignSelf: 'flex-start',
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', border: 'none', borderRadius: '8px',
                background: 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.7)', fontSize: '12px',
                cursor: 'pointer', transition: 'background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,85,58,0.12)'; e.currentTarget.style.color = '#E8553A' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
            >
              <LayoutGrid size={14} strokeWidth={1.5} />
              Agregar foto desde bolsa
            </button>
          </div>
        ) : (
          /* Cara con fotos: selector de layout + opción de agregar si hay espacio */
          <div style={{ padding: '4px 20px 12px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '12px',
            }}>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '11px', letterSpacing: '0.04em',
                color: 'rgba(255,255,255,0.38)',
              }}>
                Diseño · {selectedFace.photoIds.length} foto{selectedFace.photoIds.length !== 1 ? 's' : ''}
              </div>
              {selectedFace.photoIds.length < 5 && (
                <button
                  onClick={() => onAction('open-bag', selectedFace.id)}
                  style={{
                    background: 'none', border: 'none', padding: '2px 0',
                    color: 'rgba(255,255,255,0.38)', fontSize: '11px',
                    cursor: 'pointer', transition: 'color 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#E8553A' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.38)' }}
                >
                  + Agregar
                </button>
              )}
            </div>
            <div style={{
              display: 'flex', gap: '4px',
              overflowX: 'auto', paddingBottom: '2px',
              scrollbarWidth: 'none',
            }}>
              {LAYOUTS
                .filter(l => l.photoCount === selectedFace.photoIds.length && l.scope !== 'spread')
                .map(schema => (
                  <LayoutThumb
                    key={schema.id}
                    layoutId={schema.id}
                    isActive={schema.id === selectedFace.layout}
                    onClick={() => onAction('change-layout', schema.id)}
                  />
                ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
