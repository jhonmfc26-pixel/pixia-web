'use client'
import { useState } from 'react'
import type { PageLayout } from '@/core/modules/album/types'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'
import LayoutThumbnail from '@/core/modules/album/layouts/LayoutThumbnail'

interface EditorPanelProps {
  availableLayouts: PageLayout[]
  currentLayout: PageLayout
  selectedPageIndex: number
  totalPages: number
  onChangeLayout: (layout: PageLayout) => void
  onClose: () => void
}

const VISIBLE_INITIAL = 8
const VISIBLE_STEP = 8

export default function EditorPanel({
  availableLayouts, currentLayout, selectedPageIndex,
  totalPages, onChangeLayout, onClose,
}: EditorPanelProps) {
  const [visibleCount, setVisibleCount] = useState(VISIBLE_INITIAL)
  const visible = availableLayouts.slice(0, visibleCount)
  const hasMore = visibleCount < availableLayouts.length

  return (
    <div style={{
      position: 'fixed', right: 0, top: '56px', bottom: '48px',
      width: '280px',
      background: 'rgba(10,10,10,0.97)',
      borderLeft: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      padding: '20px 16px', gap: '16px',
      zIndex: 300, backdropFilter: 'blur(20px)',
      overflowY: 'auto',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}>
            Editando
          </span>
          <span style={{ fontSize: '18px', color: '#E8553A', fontFamily: 'Playfair Display, serif' }}>
            Página {selectedPageIndex}
          </span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            de {totalPages} páginas
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
          fontSize: '20px', lineHeight: 1,
        }}>×</button>
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Diseño de página
      </span>

      {/* Grid 2 columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {visible.map(layoutId => {
          const schema = getLayoutById(layoutId)
          if (!schema) return null
          const isActive = layoutId === currentLayout
          return (
            <button
              key={layoutId}
              onClick={() => onChangeLayout(layoutId)}
              title={schema.name}
              style={{
                background: isActive ? 'rgba(232,85,58,0.12)' : 'rgba(255,255,255,0.04)',
                border: '1px solid',
                borderColor: isActive ? '#E8553A' : 'rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '10px 8px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s',
                aspectRatio: '1',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              }}
            >
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <LayoutThumbnail schema={schema} size={schema.scope === 'spread' ? 36 : 60} active={isActive} />
              </div>
              <span style={{
                fontSize: '10px',
                color: isActive ? '#E8553A' : 'rgba(255,255,255,0.4)',
                textAlign: 'center',
                lineHeight: 1.2,
              }}>
                {schema.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* Botón Ver más */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount(c => Math.min(c + VISIBLE_STEP, availableLayouts.length))}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '10px',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          Ver más ↓
        </button>
      )}
    </div>
  )
}
