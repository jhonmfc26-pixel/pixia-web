'use client'
import { useRef, useState, useEffect } from 'react'
import type { PhotoAsset, AlbumStyle } from '@/core/contracts/AlbumBlueprint'
import type { PhotoPlacement } from '@/core/modules/album/types'
import { DEFAULT_PLACEMENT } from '@/core/modules/album/types'
import type { LayoutSchema } from '@/core/modules/album/layouts/types'
import { computeObjectPosition } from '@/core/modules/album/smartCrop'

interface LayoutRendererProps {
  schema: LayoutSchema
  photos: PhotoAsset[]
  placements: Map<string, PhotoPlacement>
  style: AlbumStyle
  spreadHalf?: 'left' | 'right'
}

function PhotoFrame({ photo, placement, style, objectPositionOverride, spreadHalf }: {
  photo: PhotoAsset
  placement: PhotoPlacement
  style: AlbumStyle
  objectPositionOverride?: string
  spreadHalf?: 'left' | 'right'
}) {
  const radius = style === 'con-margen' ? '2px' : '0'
  const containerRef = useRef<HTMLDivElement>(null)
  const [slotAspect, setSlotAspect] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (height > 0) setSlotAspect(width / height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Modo spread: div contenedor al 200% ancho, anclado por el lado correcto
  if (spreadHalf) {
    return (
      <div ref={containerRef} style={{
        position: 'relative', width: '100%', height: '100%',
        overflow: 'hidden', borderRadius: radius,
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          ...(spreadHalf === 'left' ? { left: 0 } : { right: 0 }),
          width: '200%',
          height: '100%',
        }}>
          <img
            src={photo.url}
            alt=""
            draggable={false}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              display: 'block',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    )
  }

  // Smart crop: usar si no hay ajuste manual del usuario
  const isDefault = placement.offsetX === 0 && placement.offsetY === 0 && placement.zoom === 1
  const photoAspect = (photo.width && photo.height) ? photo.width / photo.height
    : (photo.orientation === 'portrait' ? 3 / 4 : 4 / 3)
  const regions = photo.meaningRegions ?? []
  const smartPos = isDefault
    ? computeObjectPosition(photoAspect, slotAspect, regions.map(r => r.rect), photo.id)
    : null

  const posX = smartPos ? smartPos.x : 50 + placement.offsetX
  const posY = smartPos ? smartPos.y : 50 + placement.offsetY
  const safeZoom = smartPos ? 1 : Math.max(1, placement.zoom)
  const objectPosition = objectPositionOverride ?? `${posX}% ${posY}%`
  const scale = objectPositionOverride ? 1 : safeZoom

  return (
    <div ref={containerRef} style={{
      position: 'relative', width: '100%', height: '100%',
      overflow: 'hidden', borderRadius: radius,
    }}>
      <img
        src={photo.url}
        alt=""
        draggable={false}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          display: 'block',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

export default function LayoutRenderer({ schema, photos, placements, style, spreadHalf }: LayoutRendererProps) {
  const bg = style === 'con-margen' ? '#FAFAF8' : '#0f0f0f'
  const margin = schema.disableMargin ? '0px' : (style === 'con-margen' ? '10px' : '0px')
  const gap = style === 'con-margen' ? '4px' : '2px'

  const grid = (
    <div style={{
      display: 'grid',
      gridTemplateColumns: schema.grid.columns,
      gridTemplateRows: schema.grid.rows,
      gridTemplateAreas: schema.grid.areas,
      gap,
      width: '100%',
      height: '100%',
    }}>
      {schema.slots.map((slot, i) => {
        const photo = photos[i]
        if (!photo) return <div key={slot} style={{ gridArea: slot, background: 'rgba(0,0,0,0.05)' }} />
        const slotCfg = schema.slotConfig?.[i]
        const effectivePlacement = slotCfg?.disablePlacement ? DEFAULT_PLACEMENT : (placements.get(photo.id) ?? DEFAULT_PLACEMENT)
        return (
          <div key={slot} style={{ gridArea: slot, overflow: 'hidden', position: 'relative', minWidth: 0, minHeight: 0 }}>
            <PhotoFrame
              photo={photo}
              placement={effectivePlacement}
              style={style}
              objectPositionOverride={slotCfg?.objectPosition}
              spreadHalf={spreadHalf}
            />
          </div>
        )
      })}
    </div>
  )

  return (
    <div style={{
      width: '100%', height: '100%',
      background: bg, padding: margin,
      boxSizing: 'border-box',
    }}>
      {schema.innerPadding ? (
        <div style={{ width: '100%', height: '100%', padding: schema.innerPadding, boxSizing: 'border-box' }}>
          {grid}
        </div>
      ) : grid}
    </div>
  )
}
