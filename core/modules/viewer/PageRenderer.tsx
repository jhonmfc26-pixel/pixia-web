'use client'
import type { Page, PhotoPlacement } from '@/core/modules/album/types'
import { DEFAULT_PLACEMENT } from '@/core/modules/album/types'
import type { PhotoAsset, AlbumStyle } from '@/core/contracts/AlbumBlueprint'

interface PageRendererProps {
  page: Page
  photosById: Map<string, PhotoAsset>
  style: AlbumStyle
  placements?: Map<string, PhotoPlacement>
  isEditMode?: boolean
  isSelected?: boolean
  onPhotoClick?: (pageId: string, photoId: string) => void
}

// Renderiza una foto con su placement (zoom/pan)
function PhotoFrame({
  photo, placement, style, onClick,
}: {
  photo: PhotoAsset
  placement: PhotoPlacement
  style: AlbumStyle
  onClick?: () => void
}) {
  const radius = style === 'con-margen' ? '2px' : '0'
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: radius,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <img
        src={photo.url}
        alt=""
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${placement.zoom}) translate(${placement.offsetX}%, ${placement.offsetY}%)`,
          transformOrigin: 'center center',
          display: 'block',
        }}
      />
    </div>
  )
}

export default function PageRenderer({
  page, photosById, style, placements,
  isEditMode, isSelected, onPhotoClick,
}: PageRendererProps) {
  const bg      = style === 'con-margen' ? '#FAFAF8' : '#0f0f0f'
  const margin  = style === 'con-margen' ? '10px' : '0px'
  const gap     = style === 'con-margen' ? '4px' : '2px'

  const getPhoto     = (id: string) => photosById.get(id)
  const getPlacement = (id: string) => placements?.get(id) ?? DEFAULT_PLACEMENT

  const handleClick = (photoId: string) => {
    if (isEditMode && onPhotoClick) onPhotoClick(page.id, photoId)
  }

  const wrapper = (children: React.ReactNode) => (
    <div style={{
      width: '100%', height: '100%',
      background: bg,
      padding: margin,
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      {children}
      {isSelected && (
        <div style={{
          position: 'absolute', inset: 0,
          border: '2px solid #E8553A',
          background: 'rgba(232,85,58,0.06)',
          pointerEvents: 'none',
          zIndex: 20,
        }} />
      )}
    </div>
  )

  switch (page.layout) {
    case 'single': {
      const photo = getPhoto(page.photoIds[0])
      if (!photo) return wrapper(<div style={{ background: bg, width: '100%', height: '100%' }} />)
      return wrapper(
        <PhotoFrame
          photo={photo}
          placement={getPlacement(photo.id)}
          style={style}
          onClick={() => handleClick(photo.id)}
        />
      )
    }

    case 'cross-left':
    case 'cross-right': {
      const photo = getPhoto(page.photoIds[0])
      if (!photo) return wrapper(<div />)
      const objectPos = page.layout === 'cross-left' ? 'left center' : 'right center'
      return (
        <div style={{ width: '100%', height: '100%', background: bg, overflow: 'hidden', position: 'relative' }}>
          <img
            src={photo.url}
            alt=""
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              objectPosition: objectPos,
              display: 'block',
            }}
            onClick={isEditMode ? () => handleClick(photo.id) : undefined}
          />
          {isSelected && (
            <div style={{
              position: 'absolute', inset: 0,
              border: '2px solid #E8553A',
              background: 'rgba(232,85,58,0.06)',
              pointerEvents: 'none', zIndex: 20,
            }} />
          )}
        </div>
      )
    }

    case 'portrait': {
      const photo = getPhoto(page.photoIds[0])
      if (!photo) return wrapper(<div />)
      return wrapper(
        <div style={{ width: '100%', height: '100%', padding: '15%', boxSizing: 'border-box' }}>
          <PhotoFrame
            photo={photo}
            placement={getPlacement(photo.id)}
            style={style}
            onClick={() => handleClick(photo.id)}
          />
        </div>
      )
    }

    case 'stack-2':
      return wrapper(
        <div style={{ display: 'flex', flexDirection: 'column', gap, height: '100%' }}>
          {page.photoIds.slice(0, 2).map(id => {
            const photo = getPhoto(id)
            if (!photo) return <div key={id} style={{ flex: 1 }} />
            return (
              <div key={id} style={{ flex: 1, minHeight: 0 }}>
                <PhotoFrame
                  photo={photo}
                  placement={getPlacement(id)}
                  style={style}
                  onClick={() => handleClick(id)}
                />
              </div>
            )
          })}
        </div>
      )

    case 'side-2':
      return wrapper(
        <div style={{ display: 'flex', gap, height: '100%' }}>
          {page.photoIds.slice(0, 2).map(id => {
            const photo = getPhoto(id)
            if (!photo) return <div key={id} style={{ flex: 1 }} />
            return (
              <div key={id} style={{ flex: 1, minWidth: 0 }}>
                <PhotoFrame
                  photo={photo}
                  placement={getPlacement(id)}
                  style={style}
                  onClick={() => handleClick(id)}
                />
              </div>
            )
          })}
        </div>
      )

    case 'grid-3':
      return wrapper(
        <div style={{ display: 'flex', gap, height: '100%' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {getPhoto(page.photoIds[0]) && (
              <PhotoFrame
                photo={getPhoto(page.photoIds[0])!}
                placement={getPlacement(page.photoIds[0])}
                style={style}
                onClick={() => handleClick(page.photoIds[0])}
              />
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap, minWidth: 0 }}>
            {page.photoIds.slice(1, 3).map(id => {
              const photo = getPhoto(id)
              if (!photo) return <div key={id} style={{ flex: 1 }} />
              return (
                <div key={id} style={{ flex: 1, minHeight: 0 }}>
                  <PhotoFrame
                    photo={photo}
                    placement={getPlacement(id)}
                    style={style}
                    onClick={() => handleClick(id)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )

    case 'grid-4':
      return wrapper(
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap,
          height: '100%',
        }}>
          {page.photoIds.slice(0, 4).map(id => {
            const photo = getPhoto(id)
            if (!photo) return <div key={id} />
            return (
              <div key={id} style={{ minWidth: 0, minHeight: 0 }}>
                <PhotoFrame
                  photo={photo}
                  placement={getPlacement(id)}
                  style={style}
                  onClick={() => handleClick(id)}
                />
              </div>
            )
          })}
        </div>
      )

    default:
      return wrapper(<div />)
  }
}
