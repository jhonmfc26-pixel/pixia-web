'use client'
import { useState, useRef, useEffect } from 'react'
import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { PhotoPlacement } from '@/core/modules/album/types'

interface EditorPhotoFrameProps {
  photo: PhotoAsset
  placement: PhotoPlacement
  isAdjusting: boolean
  onStartAdjust: () => void
  onEndAdjust: () => void
  onUpdatePlacement: (placement: PhotoPlacement) => void
  onReplace?: () => void
  onDelete?: () => void
}

export default function EditorPhotoFrame({
  photo, placement, isAdjusting,
  onStartAdjust, onEndAdjust, onUpdatePlacement, onReplace, onDelete,
}: EditorPhotoFrameProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 })

  const posX = 50 + placement.offsetX
  const posY = 50 + placement.offsetY
  const safeZoom = Math.max(1, placement.zoom)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isAdjusting) return
    setIsDragging(true)
    dragStart.current = {
      x: e.clientX, y: e.clientY,
      offsetX: placement.offsetX,
      offsetY: placement.offsetY,
    }
  }

  useEffect(() => {
    if (!isDragging || !isAdjusting) return
    const handleMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStart.current.x) / 8
      const dy = (e.clientY - dragStart.current.y) / 8
      onUpdatePlacement({
        zoom: placement.zoom,
        offsetX: Math.max(-50, Math.min(50, dragStart.current.offsetX - dx)),
        offsetY: Math.max(-50, Math.min(50, dragStart.current.offsetY - dy)),
      })
    }
    const handleUp = () => setIsDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [isDragging, isAdjusting, placement, onUpdatePlacement])

  const handleWheel = (e: React.WheelEvent) => {
    if (!isAdjusting) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    const newZoom = Math.max(1, Math.min(3, placement.zoom + delta))
    if (newZoom === placement.zoom) return
    onUpdatePlacement({ ...placement, zoom: newZoom })
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      style={{
        position: 'relative',
        width: '100%', height: '100%',
        overflow: 'hidden',
        background: '#000',
        cursor: isAdjusting ? (isDragging ? 'grabbing' : 'grab') : 'default',
      }}
    >
      <img
        src={photo.url}
        alt=""
        draggable={false}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: `${posX}% ${posY}%`,
          transform: `scale(${safeZoom})`,
          transformOrigin: 'center center',
          display: 'block',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />

      {!isAdjusting && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          display: 'flex', gap: '6px', zIndex: 30,
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); onStartAdjust() }}
            title="Ajustar"
            style={{
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: 'white', fontSize: '13px',
              cursor: 'pointer', lineHeight: 1,
            }}
          >🔧</button>
          {onReplace && (
            <button
              onClick={(e) => { e.stopPropagation(); onReplace() }}
              title="Cambiar foto"
              style={{
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: 'white', fontSize: '13px',
                cursor: 'pointer', lineHeight: 1,
              }}
            >🔄</button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              title="Eliminar foto"
              style={{
                background: 'rgba(220,38,38,0.85)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 10px',
                color: 'white', fontSize: '13px',
                cursor: 'pointer', lineHeight: 1,
              }}
            >🗑</button>
          )}
        </div>
      )}

      {isAdjusting && (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            border: '3px solid #E8553A',
            pointerEvents: 'none', zIndex: 25,
          }} />
          <button
            onClick={(e) => { e.stopPropagation(); onEndAdjust() }}
            style={{
              position: 'absolute', top: '10px', left: '10px',
              background: '#E8553A', border: 'none',
              borderRadius: '6px', padding: '6px 12px',
              color: 'white', fontSize: '11px',
              fontWeight: 500, cursor: 'pointer', zIndex: 30,
            }}
          >
            ✓ Listo
          </button>
        </>
      )}
    </div>
  )
}
