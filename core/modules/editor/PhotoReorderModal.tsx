'use client'
import { useState, memo, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'

interface PhotoReorderModalProps {
  photoIds: string[]
  photosById: Map<string, PhotoAsset>
  onSave: (newOrder: string[]) => void
  onClose: () => void
}

interface SortablePhotoProps {
  id: string
  index: number
  photo: PhotoAsset | undefined
}

const SortablePhoto = memo(function SortablePhoto({ id, index, photo }: SortablePhotoProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const renderCountRef = useRef(0)
  renderCountRef.current++

  const style = {
    transform: CSS.Transform.toString(transform) || 'translateZ(0)',
    transition,
    opacity: isDragging ? 0.4 : 1,
    willChange: 'transform',
  }

  if (!photo) return null

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: 'relative',
        aspectRatio: '1',
        borderRadius: '6px',
        overflow: 'hidden',
        cursor: 'grab',
        background: '#0a0a0a',
        touchAction: 'none',
      }}
      onMouseDown={() => {
        // Exponer timestamp al window para que perfRef del padre lo lea
        ;(window as unknown as Record<string, number>).__pixia_mousedown = performance.now()
      }}
      {...attributes}
      {...listeners}
    >
      <img
        src={photo.thumbnailUrl || photo.url}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        width={110}
        height={110}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover',
          display: 'block',
          pointerEvents: 'none',
          userSelect: 'none',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
      />
      <div style={{
        position: 'absolute', top: 4, left: 4,
        background: 'rgba(0,0,0,0.75)',
        color: 'white',
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        pointerEvents: 'none',
      }}>
        {index + 1}
      </div>
    </div>
  )
})

export default function PhotoReorderModal({
  photoIds, photosById, onSave, onClose,
}: PhotoReorderModalProps) {
  const [order, setOrder] = useState<string[]>(photoIds)
  const [activeId, setActiveId] = useState<string | null>(null)

  const perfRef = useRef<{
    mousedownAt: number
    renderCount: number
    dragStartedAt: number
  }>({ mousedownAt: 0, renderCount: 0, dragStartedAt: 0 })
  perfRef.current.renderCount++

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const now = performance.now()
    perfRef.current.dragStartedAt = now
    const mousedownAt = (window as unknown as Record<string, number>).__pixia_mousedown || now
    console.log('[Perf] dragStart latency:',
      (now - mousedownAt).toFixed(1), 'ms',
      '| renders desde mount:', perfRef.current.renderCount,
      '| items:', order.length
    )
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(active.id as string)
    const newIndex = order.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    setOrder(arrayMove(order, oldIndex, newIndex))
    const duration = performance.now() - perfRef.current.dragStartedAt
    console.log('[Perf] drag duration:', duration.toFixed(1), 'ms',
      '| moved:', oldIndex, '→', newIndex
    )
  }

  const handleSave = () => {
    onSave(order)
    onClose()
  }

  const activePhoto = activeId ? photosById.get(activeId) : null

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
          width: '100%', maxWidth: '900px',
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Reordenar fotos
            </div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', color: 'white', marginTop: '4px' }}>
              Arrastra para cambiar el orden
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            fontSize: '22px', cursor: 'pointer', lineHeight: 1,
          }}>×</button>
        </div>

        {/* Grid arrastrable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={order} strategy={rectSortingStrategy}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: '8px',
              }}>
                {order.map((id, idx) => (
                  <SortablePhoto
                    key={id}
                    id={id}
                    index={idx}
                    photo={photosById.get(id)}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activePhoto ? (
                <div style={{
                  aspectRatio: '1',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                  cursor: 'grabbing',
                  transform: 'scale(1.05)',
                }}>
                  <img
                    src={activePhoto.thumbnailUrl || activePhoto.url}
                    alt=""
                    loading="eager"
                    width={110}
                    height={110}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: '12px',
          padding: '16px 24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '14px', cursor: 'pointer',
            }}
          >Cancelar</button>
          <button
            onClick={handleSave}
            style={{
              flex: 2, padding: '12px',
              background: '#E8553A',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px', fontWeight: 500,
              cursor: 'pointer',
            }}
          >Aplicar nuevo orden</button>
        </div>
      </div>
    </div>
  )
}
