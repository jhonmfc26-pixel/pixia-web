'use client'

import { getLayoutById } from '@/core/modules/album/layouts/helpers'
import type { ShowcasePage, ShowcaseSpread } from './showcase'

/**
 * Álbum Pixia abierto, dibujado con los MISMOS layouts del motor (grid +
 * áreas del registro). Lo que se ve en la home es la geometría real de las
 * páginas que imprime Pixia, no una ilustración.
 */

const PAPER = '#F7F4EE'

function Page({ page, side }: { page: ShowcasePage; side: 'left' | 'right' }) {
  const schema = getLayoutById(page.layout)
  if (!schema) return <div style={{ background: PAPER }} />
  // El interior se imprime a sangre; el papel solo aparece en las celdas
  // vacías ('.') de los layouts con aire y en un filete fino entre fotos.
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: PAPER }}>
      <div
        className="h-full w-full"
        style={{
          display: 'grid',
          gridTemplateColumns: schema.grid.columns,
          gridTemplateRows: schema.grid.rows,
          gridTemplateAreas: schema.grid.areas,
          gap: schema.photoCount > 1 ? '0.8%' : 0,
          padding: schema.innerPadding ?? 0,
          boxSizing: 'border-box',
        }}
      >
        {schema.slots.map((slot, i) => {
          const photo = page.photos[i]
          if (!photo) return null
          return (
            <div key={slot} style={{ gridArea: slot, overflow: 'hidden', minHeight: 0, minWidth: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.src} alt={photo.alt} loading={page.eager ? 'eager' : 'lazy'} decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: photo.position ?? 'center', display: 'block' }} />
            </div>
          )
        })}
      </div>
      {/* Curvatura del papel hacia el lomo */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0" style={{
        [side === 'left' ? 'right' : 'left']: 0,
        width: '14%',
        background: `linear-gradient(to ${side === 'left' ? 'left' : 'right'}, rgba(0,0,0,0.22), rgba(0,0,0,0.06) 40%, transparent)`,
      }} />
    </div>
  )
}

export default function AlbumMockup({ spread, tilt = false, className = '' }: { spread: ShowcaseSpread; tilt?: boolean; className?: string }) {
  return (
    <div className={className} style={{ perspective: '2200px' }}>
      <div
        role="img"
        aria-label={spread.alt}
        className="relative grid grid-cols-2"
        style={{
          aspectRatio: '2 / 1',
          transform: tilt ? 'rotateX(8deg)' : undefined,
          transformOrigin: '50% 100%',
          borderRadius: '3px',
          boxShadow: '0 50px 90px -30px rgba(0,0,0,0.85), 0 18px 40px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        <Page page={spread.left} side="left" />
        <Page page={spread.right} side="right" />
        {/* Lomo */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" style={{ background: 'rgba(0,0,0,0.18)' }} />
      </div>
    </div>
  )
}
