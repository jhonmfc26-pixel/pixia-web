'use client'

import type { ReactNode } from 'react'
import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { Face } from '@/core/modules/foldModel/types'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'
import { slotAspectRatios } from '@/core/modules/album/layoutFit'
import { DedicationCard } from '@/core/modules/dedication/DedicationCard'
import { manualCoverStyle, aspectOf } from '@/core/modules/viewer/manualCover'
import PixiaImage from '@/components/ui/PixiaImage'

/**
 * Sombra de lomo pegada al borde interior de la propia página, no un overlay
 * global — así viaja CON la hoja cuando react-pageflip la anima (z-index de
 * la hoja en giro), en vez de quedar flotando por encima de ella. Solo la
 * usa el viewer animado (PixiaFlipBook); el fallback estático (sin curl 3D)
 * sigue con su overlay global, donde no hay problema de capas.
 */
function GutterEdge({ side }: { side: 'left' | 'right' }) {
  return (
    <div style={{
      position: 'absolute', top: 0, bottom: 0,
      [side === 'left' ? 'right' : 'left']: 0,
      width: 'clamp(7px, 2.5%, 18px)',
      background: side === 'left'
        ? 'linear-gradient(to left, rgba(0,0,0,0.22), rgba(0,0,0,0))'
        : 'linear-gradient(to right, rgba(0,0,0,0.22), rgba(0,0,0,0))',
      pointerEvents: 'none',
    }} />
  )
}

/** Cara solo-lectura (una mitad de pliego "paired"). */
export function FacePageView({ face, photosById, side }: {
  face: Face
  photosById: Map<string, PhotoAsset>
  /** Si se da, dibuja la sombra de lomo en el borde interior de esta cara. */
  side?: 'left' | 'right'
}) {
  let content: ReactNode
  if (face.kind === 'dedication' && face.dedication) {
    const photo = face.dedication.photoId ? photosById.get(face.dedication.photoId) : undefined
    content = <DedicationCard dedication={face.dedication} photo={photo} />
  } else if (face.isEmpty) {
    content = <div style={{ width: '100%', height: '100%', background: '#F9F6F1' }} />
  } else {
    const schema = getLayoutById(face.layout)
    if (!schema) {
      content = <div style={{ width: '100%', height: '100%', background: '#111' }} />
    } else {
      // Proporción de cada slot — asume página cuadrada (30x30/20x20, los
      // formatos confirmados/en uso real hoy; ver el mismo supuesto en
      // layoutFit.ts). Se usa para el cálculo manual de "cover" en vez de
      // object-fit:cover (ver manualCover.ts — evita que Chromium rasterice
      // la foto al exportar a PDF).
      const slotArs = slotAspectRatios(face.layout)
      content = (
        <div style={{
          width: '100%', height: '100%',
          padding: schema.innerPadding ?? '0px',
          boxSizing: 'border-box',
          background: schema.hasAir ? '#F9F6F1' : undefined,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: schema.grid.columns,
            gridTemplateRows: schema.grid.rows,
            gridTemplateAreas: schema.grid.areas,
            gap: '2px', width: '100%', height: '100%',
          }}>
            {schema.slots.map((slot, i) => {
              const photo = photosById.get(face.photoIds[i])
              return (
                <div
                  key={slot}
                  style={{ gridArea: slot, position: 'relative', overflow: 'hidden', background: '#E4E0D8', minWidth: 0, minHeight: 0 }}
                >
                  {photo && (
                    <PixiaImage
                      src={photo.url || photo.thumbnailUrl}
                      alt=""
                      draggable={false}
                      style={{
                        ...manualCoverStyle(aspectOf(photo.width, photo.height), slotArs[i] ?? 1, 'center center'),
                        userSelect: 'none', pointerEvents: 'none',
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {content}
      {side && <GutterEdge side={side} />}
    </div>
  )
}

/**
 * Mitad de hero-spread. Las dos mitades siempre aparecen en el mismo pliego
 * por construcción del foldModel — nunca se parten entre pliegos distintos.
 */
export function HeroSpreadPageView({ face, photosById, half }: {
  face: Face
  photosById: Map<string, PhotoAsset>
  half: 'left' | 'right'
}) {
  const photo = photosById.get(face.photoIds[0])
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#E4E0D8' }}>
      <div style={{
        position: 'absolute', top: 0,
        ...(half === 'left' ? { left: 0 } : { right: 0 }),
        width: '200%', height: '100%',
      }}>
        {photo && (
          <PixiaImage
            src={photo.url || photo.thumbnailUrl}
            alt=""
            draggable={false}
            style={{
              // El div padre (este "window") YA representa el área completa
              // del spread a 2 páginas (width:200% de una página cuadrada =
              // aspecto 2:1) — la foto cubre ESE contenedor, no la mitad
              // visible; containerAspect=2 matchea lo que object-fit:cover
              // llenaba antes acá. Ver manualCover.ts.
              ...manualCoverStyle(aspectOf(photo.width, photo.height), 2, 'center center'),
              userSelect: 'none', pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  )
}
