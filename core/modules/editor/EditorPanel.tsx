'use client'
import type { PageLayout } from '@/core/modules/album/types'

interface EditorPanelProps {
  availableLayouts: PageLayout[]
  currentLayout: PageLayout
  selectedPageIndex: number
  totalPages: number
  onChangeLayout: (layout: PageLayout) => void
  onClose: () => void
}

const LAYOUT_LABELS: Record<PageLayout, string> = {
  'single':       '1 foto',
  'stack-2':      '2 apiladas',
  'side-2':       '2 lado a lado',
  'grid-3':       '3 fotos',
  'grid-4':       '4 fotos',
  'portrait':     'Vertical con aire',
  'hero-spread':  'Doble página',
}

const LAYOUT_PREVIEWS: Record<PageLayout, React.ReactElement> = {
  'single': (
    <svg width="44" height="32" viewBox="0 0 44 32">
      <rect x="2" y="2" width="40" height="28" fill="rgba(255,255,255,0.18)" rx="2"/>
    </svg>
  ),
  'stack-2': (
    <svg width="44" height="32" viewBox="0 0 44 32">
      <rect x="2" y="2" width="40" height="13" fill="rgba(255,255,255,0.18)" rx="2"/>
      <rect x="2" y="17" width="40" height="13" fill="rgba(255,255,255,0.18)" rx="2"/>
    </svg>
  ),
  'side-2': (
    <svg width="44" height="32" viewBox="0 0 44 32">
      <rect x="2" y="2" width="19" height="28" fill="rgba(255,255,255,0.18)" rx="2"/>
      <rect x="23" y="2" width="19" height="28" fill="rgba(255,255,255,0.18)" rx="2"/>
    </svg>
  ),
  'grid-3': (
    <svg width="44" height="32" viewBox="0 0 44 32">
      <rect x="2" y="2" width="19" height="28" fill="rgba(255,255,255,0.18)" rx="2"/>
      <rect x="23" y="2" width="19" height="13" fill="rgba(255,255,255,0.18)" rx="2"/>
      <rect x="23" y="17" width="19" height="13" fill="rgba(255,255,255,0.18)" rx="2"/>
    </svg>
  ),
  'grid-4': (
    <svg width="44" height="32" viewBox="0 0 44 32">
      <rect x="2" y="2" width="19" height="13" fill="rgba(255,255,255,0.18)" rx="2"/>
      <rect x="23" y="2" width="19" height="13" fill="rgba(255,255,255,0.18)" rx="2"/>
      <rect x="2" y="17" width="19" height="13" fill="rgba(255,255,255,0.18)" rx="2"/>
      <rect x="23" y="17" width="19" height="13" fill="rgba(255,255,255,0.18)" rx="2"/>
    </svg>
  ),
  'portrait': (
    <svg width="44" height="32" viewBox="0 0 44 32">
      <rect x="14" y="5" width="16" height="22" fill="rgba(255,255,255,0.18)" rx="2"/>
    </svg>
  ),
  'hero-spread': (
    <svg width="44" height="32" viewBox="0 0 44 32">
      <rect x="2" y="2" width="40" height="28" fill="rgba(255,255,255,0.28)" rx="2"/>
      <line x1="22" y1="2" x2="22" y2="30" stroke="rgba(0,0,0,0.3)" strokeWidth="1" strokeDasharray="3 2"/>
    </svg>
  ),
}

export default function EditorPanel({
  availableLayouts, currentLayout, selectedPageIndex,
  totalPages, onChangeLayout, onClose,
}: EditorPanelProps) {
  return (
    <div style={{
      position: 'fixed', right: 0, top: '56px', bottom: '48px',
      width: '240px',
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
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
            fontSize: '20px', lineHeight: 1 }}
        >×</button>
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

      {/* Layouts */}
      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Diseño de página
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {availableLayouts.map(layout => {
          const isActive = layout === currentLayout
          return (
            <button
              key={layout}
              onClick={() => onChangeLayout(layout)}
              style={{
                background: isActive ? 'rgba(232,85,58,0.12)' : 'rgba(255,255,255,0.04)',
                border: '1px solid',
                borderColor: isActive ? '#E8553A' : 'rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '10px',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '12px',
                width: '100%', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              }}
            >
              {LAYOUT_PREVIEWS[layout]}
              <span style={{ fontSize: '12px', color: isActive ? '#E8553A' : 'rgba(255,255,255,0.55)' }}>
                {LAYOUT_LABELS[layout]}
              </span>
            </button>
          )
        })}
      </div>

    </div>
  )
}
