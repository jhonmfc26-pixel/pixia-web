'use client'
import { useState, useEffect, useRef } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, DragOverlay,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'
import type { AlbumStructure, Face } from '../types'
import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { SelState } from './selectionTypes'

// ── Render de cara genérica con selección ─────────────────────────────────────
// Face selection is handled by the parent panel (FoldStructureViewer).
// FaceReadView only handles photo-level selection inside each slot.

/**
 * Slot de foto dentro de una cara — arrastrable (reordena dentro de la MISMA
 * cara) y a la vez seleccionable con tap corto. dnd-kit con activation
 * constraint por distancia distingue ambos gestos: si el puntero no se mueve
 * más allá del umbral, nunca arranca el drag y el onClick de React llega
 * normal; si se mueve, dnd-kit toma el gesto y suprime el click posterior.
 *
 * No se usa SortableContext/useSortable con su reflow automático a propósito:
 * los slots viven en celdas de CSS Grid de tamaño HETEROGÉNEO (ej. hero-3-top
 * tiene un slot 6× más grande que los otros), y el transform de reflow de
 * useSortable asume una lista de rects más o menos uniforme — se ve raro ahí.
 * En su lugar: DragOverlay muestra la foto levantada (flota libre, sin
 * relación con el grid) y el slot bajo el puntero se resalta como indicador
 * de destino — simple y correcto para cualquier geometría de layout.
 */
function DraggableSlot({ slot, photoId, photo, isSelected, hasSel, isDropTarget, isDragged, onSel }: {
  slot: string
  photoId: string | undefined
  photo: PhotoAsset | undefined
  isSelected: boolean
  hasSel: boolean
  isDropTarget: boolean
  isDragged: boolean
  onSel: (rect: DOMRect) => void
}) {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: photoId ?? `__empty-${slot}`,
    disabled: !photoId,
  })
  const { setNodeRef: setDropRef } = useDroppable({ id: photoId ?? `__empty-${slot}` })
  const setRefs = (el: HTMLDivElement | null) => { setDragRef(el); setDropRef(el) }

  return (
    <div
      ref={setRefs}
      {...(photo ? attributes : {})}
      {...(photo ? listeners : {})}
      onClick={photo ? (e) => { e.stopPropagation(); onSel(e.currentTarget.getBoundingClientRect()) } : undefined}
      style={{
        gridArea: slot,
        position: 'relative',
        overflow: 'hidden',
        background: '#E4E0D8',
        minWidth: 0, minHeight: 0,
        cursor: photo ? 'grab' : 'default',
        touchAction: photo ? 'none' : undefined,
        // Resaltado: anillo coral inset para selección; anillo más grueso
        // para indicar dónde caería la foto que se está arrastrando.
        opacity: isDragged ? 0.25 : (hasSel && !isSelected ? 0.45 : 1),
        boxShadow: isDropTarget
          ? 'inset 0 0 0 3px #E8553A'
          : isSelected ? 'inset 0 0 0 2px #E8553A' : 'none',
        zIndex: isSelected || isDropTarget ? 1 : 0,
        transition: 'opacity 0.15s, box-shadow 0.15s',
      }}
    >
      {photo && (
        <img
          src={photo.url || photo.thumbnailUrl}
          alt=""
          draggable={false}
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center center',
            display: 'block', userSelect: 'none', pointerEvents: 'none',
            transform: isSelected ? 'scale(1.03) translateY(-2px)' : 'scale(1)',
            transition: 'transform 0.15s',
          }}
        />
      )}
    </div>
  )
}

function FaceReadView({ face, photosById, sel, onSel, onReorder }: {
  face: Face
  photosById: Map<string, PhotoAsset>
  sel: SelState
  onSel: (sel: SelState, rect?: DOMRect) => void
  onReorder: (faceId: string, fromIndex: number, toIndex: number) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string)
  const handleDragOver = (event: DragOverEvent) => setOverId(event.over ? (event.over.id as string) : null)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)
    if (!over || active.id === over.id) return
    const fromIndex = face.photoIds.indexOf(active.id as string)
    const toIndex = face.photoIds.indexOf(over.id as string)
    if (fromIndex === -1 || toIndex === -1) return
    onReorder(face.id, fromIndex, toIndex)
  }

  // Cara vacía: hueco de edición
  if (face.isEmpty) {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onSel({ type: 'face', id: face.id }, e.currentTarget.getBoundingClientRect()) }}
        style={{
          width: '100%', height: '100%', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#F9F6F1',
          border: '2px dashed rgba(0,0,0,0.15)',
          gap: '6px', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '22px', lineHeight: 1, color: 'rgba(0,0,0,0.22)' }}>+</span>
        <span style={{ fontSize: '10px', letterSpacing: '0.04em', color: 'rgba(0,0,0,0.28)' }}>Agregar foto</span>
      </div>
    )
  }

  const schema = getLayoutById(face.layout)
  if (!schema) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F9F6F1', color: 'rgba(40,36,30,0.4)', fontSize: 11,
      }}>
        layout desconocido: {face.layout}
      </div>
    )
  }

  const innerPadding = schema.innerPadding ?? '0px'
  // Las celdas '.' de layouts con aire deben verse como papel (crema), nunca negro.
  const bgColor = schema.hasAir ? '#F9F6F1' : undefined
  const hasSel = sel !== null
  const activePhoto = activeId ? photosById.get(activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div style={{ width: '100%', height: '100%', padding: innerPadding, boxSizing: 'border-box', background: bgColor }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: schema.grid.columns,
          gridTemplateRows: schema.grid.rows,
          gridTemplateAreas: schema.grid.areas,
          gap: '2px', width: '100%', height: '100%',
        }}>
          {schema.slots.map((slot, i) => {
            const photoId = face.photoIds[i]
            const photo = photoId ? photosById.get(photoId) : undefined
            const isSelected = !!photoId && sel?.type === 'photo' && sel.id === photoId

            return (
              <DraggableSlot
                key={slot}
                slot={slot}
                photoId={photoId}
                photo={photo}
                isSelected={isSelected}
                hasSel={hasSel}
                isDropTarget={!!photoId && overId === photoId && activeId !== photoId}
                isDragged={!!photoId && activeId === photoId}
                onSel={(rect) => onSel({ type: 'photo', id: photoId }, rect)}
              />
            )
          })}
        </div>
      </div>

      <DragOverlay>
        {activePhoto ? (
          <div style={{
            width: '72px', height: '72px', borderRadius: '4px', overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)', transform: 'scale(1.08)',
            cursor: 'grabbing',
          }}>
            <img
              src={activePhoto.thumbnailUrl || activePhoto.url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ── Mitad de hero-spread ──────────────────────────────────────────────────────

function HeroSpreadHalf({ photo, half }: {
  photo: PhotoAsset | undefined
  half: 'left' | 'right'
}) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#E4E0D8' }}>
      <div style={{
        position: 'absolute', top: 0,
        ...(half === 'left' ? { left: 0 } : { right: 0 }),
        width: '200%', height: '100%',
      }}>
        {photo && (
          <img
            src={photo.url || photo.thumbnailUrl}
            alt=""
            draggable={false}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center center',
              display: 'block', userSelect: 'none', pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  )
}

// ── Lomo (gutter) ────────────────────────────────────────────────────────────
// Solo en pantalla. El PDF usa pdf-lib directamente y nunca pasa por este componente,
// pero se controla con showGutter (default true) para dejar la intención explícita.

// Ajustar alpha si el lomo se ve muy marcado (bajar) o imperceptible (subir).
// Sutil a propósito — es una sombra de pliegue, no una franja separadora.
const GUTTER_SHADOW =
  'linear-gradient(to right,' +
  '  rgba(0,0,0,0) 0%,' +
  '  rgba(0,0,0,0.06) 45%,' +
  '  rgba(0,0,0,0.12) 50%,' +
  '  rgba(0,0,0,0.06) 55%,' +
  '  rgba(0,0,0,0) 100%)'

// Fade sutil al cambiar de pliego — mesa de trabajo, no libro: sin curl 3D.
const FOLD_FADE_KEYFRAMES = `@keyframes pixia-fold-fade { from { opacity: 0 } to { opacity: 1 } }`

// ── Viewer principal ──────────────────────────────────────────────────────────

interface FoldStructureViewerProps {
  structure: AlbumStructure
  photosById: Map<string, PhotoAsset>
  sel: SelState
  onSel: (sel: SelState, rect?: DOMRect) => void
  /** Mostrar lomo de pliegue. true por defecto. Pasar false en ruta PDF. */
  showGutter?: boolean
  /**
   * Índice de pliego actual, controlado por el padre — así el padre puede
   * leerlo (para navegar "Listo" → viewer en la misma posición) y sembrarlo
   * desde ?spread= al entrar desde el viewer.
   */
  currentFold: number
  onFoldChange: (idx: number) => void
  /** Reordena fotos DENTRO de una misma cara (drag) — no cambia el layout. */
  onReorder: (faceId: string, fromIndex: number, toIndex: number) => void
}

export default function FoldStructureViewer({
  structure, photosById, sel, onSel, showGutter = true,
  currentFold, onFoldChange, onReorder,
}: FoldStructureViewerProps) {

  // ── Fit-contain sizing ─────────────────────────────────────────────────────
  // Un pliego = dos caras cuadradas → relación 2:1. ResizeObserver calcula el
  // tamaño de cara que cabe en el área disponible respetando ambas dimensiones.
  const areaRef = useRef<HTMLDivElement>(null)
  const [panelSize, setPanelSize] = useState(480)

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      // 48px margen horizontal total (24px por lado); sin gap entre paneles
      const byWidth = (width - 48) / 2
      // 40px margen vertical (20px top + bottom)
      const byHeight = height - 40
      setPanelSize(Math.floor(Math.max(100, Math.min(byWidth, byHeight))))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // El gutter escala con el panel para que la proporción se mantenga —
  // angosto: es una sombra de lomo, no una franja separadora.
  const gutterWidth = Math.round(Math.min(18, Math.max(8, panelSize * 0.025)))

  const { folds } = structure
  const totalFolds = folds.length
  // currentFold puede llegar fuera de rango desde ?spread= (álbum editado,
  // link viejo) — acotar solo para leer, sin tocar el estado del padre.
  const displayFold = Math.max(0, Math.min(totalFolds - 1, currentFold))
  const fold = folds[displayFold]

  if (!fold) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(40,36,30,0.4)' }}>
        No hay pliegos.
      </div>
    )
  }

  const isFaceSelected = (faceId: string) => sel?.type === 'face' && sel.id === faceId

  // Sombra gris cálida y difusa — coherente con el viewer, no negra dura.
  const PANEL_SHADOW = '0 18px 40px rgba(80,68,52,0.22), 0 6px 14px rgba(80,68,52,0.14)'

  const panelBase: React.CSSProperties = {
    width: `${panelSize}px`,
    height: `${panelSize}px`,
    background: '#F9F6F1',
    boxShadow: PANEL_SHADOW,
    position: 'relative',
    flexShrink: 0,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'box-shadow 0.15s',
  }

  const renderPairedPanel = (face: Face) => (
    <div
      key={face.id}
      onClick={(e) => { e.stopPropagation(); onSel({ type: 'face', id: face.id }, e.currentTarget.getBoundingClientRect()) }}
      style={{
        ...panelBase,
        // Resaltado de cara: anillo coral externo visible sobre el papel claro
        boxShadow: isFaceSelected(face.id)
          ? `0 0 0 2px #E8553A, ${PANEL_SHADOW}`
          : PANEL_SHADOW,
      }}
    >
      <FaceReadView face={face} photosById={photosById} sel={sel} onSel={onSel} onReorder={onReorder} />
    </div>
  )

  return (
    <>
      <style>{FOLD_FADE_KEYFRAMES}</style>

      {/* Área del pliego — click en fondo → deseleccionar */}
      <div
        ref={areaRef}
        onClick={() => onSel(null)}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          // Sin gap entre caras — se tocan al centro, igual que en el viewer.
          // Solo el lomo (overlay absoluto de abajo) marca el pliegue.
          gap: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Lomo del pliegue — solo en pantalla, pointer-events:none para no interferir con clicks */}
        {showGutter && (
          <div style={{
            position: 'absolute',
            left: '50%', transform: 'translateX(-50%)',
            top: 0, bottom: 0,
            width: `${gutterWidth}px`,
            background: GUTTER_SHADOW,
            pointerEvents: 'none',
            zIndex: 10,
          }} />
        )}

        {/* key={fold.id} → remonta al cambiar de pliego, disparando el fade */}
        <div key={fold.id} style={{ display: 'flex', animation: 'pixia-fold-fade 180ms ease-out' }}>
          {fold.kind === 'paired' ? (
            <>
              {renderPairedPanel(fold.left)}
              {renderPairedPanel(fold.right)}
            </>
          ) : (() => {
            const photo = photosById.get(fold.face.photoIds[0])
            const faceSel = isFaceSelected(fold.face.id)
            const spreadPanelStyle: React.CSSProperties = {
              ...panelBase,
              boxShadow: faceSel
                ? `0 0 0 2px #E8553A, ${PANEL_SHADOW}`
                : PANEL_SHADOW,
            }
            return (
              <>
                <div
                  style={spreadPanelStyle}
                  onClick={(e) => { e.stopPropagation(); onSel({ type: 'face', id: fold.face.id }, e.currentTarget.getBoundingClientRect()) }}
                >
                  <HeroSpreadHalf photo={photo} half="left" />
                </div>
                <div
                  style={spreadPanelStyle}
                  onClick={(e) => { e.stopPropagation(); onSel({ type: 'face', id: fold.face.id }, e.currentTarget.getBoundingClientRect()) }}
                >
                  <HeroSpreadHalf photo={photo} half="right" />
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Barra inferior — navegación entre pliegos; navegar limpia la selección */}
      <div style={{
        height: '64px', flexShrink: 0,
        background: 'rgba(10,10,10,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
      }}>
        <button
          onClick={() => { onSel(null); onFoldChange(Math.max(0, displayFold - 1)) }}
          disabled={displayFold === 0}
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'white', fontSize: '18px',
            cursor: displayFold === 0 ? 'default' : 'pointer',
            opacity: displayFold === 0 ? 0.3 : 1,
          }}
        >‹</button>

        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', minWidth: '80px', textAlign: 'center' }}>
          {displayFold + 1} / {totalFolds}
        </span>

        <button
          onClick={() => { onSel(null); onFoldChange(Math.min(totalFolds - 1, displayFold + 1)) }}
          disabled={displayFold >= totalFolds - 1}
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'white', fontSize: '18px',
            cursor: displayFold >= totalFolds - 1 ? 'default' : 'pointer',
            opacity: displayFold >= totalFolds - 1 ? 0.3 : 1,
          }}
        >›</button>
      </div>
    </>
  )
}
