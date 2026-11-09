'use client'

import type { ReactNode } from 'react'
import type { PhotoAsset, AlbumStyle } from '@/core/contracts/AlbumBlueprint'
import type { Face } from '@/core/modules/foldModel/types'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'
import { slotAspectRatios } from '@/core/modules/album/layoutFit'
import { DedicationCard } from '@/core/modules/dedication/DedicationCard'
import { manualCoverStyle, aspectOf } from '@/core/modules/viewer/manualCover'
import PixiaImage from '@/components/ui/PixiaImage'
import { usePageAspect } from './PageAspectContext'

// Margen de página para el estilo 'con-margen' — valor de diseño elegido acá:
// no hay ninguna convención previa que reutilizar (CoverPage.tsx declara la
// prop `style` pero nunca la usa — la portada tampoco implementaba con-margen
// hoy). Porcentual, no px fijo, para que se comporte igual en el viewer (DOM,
// px) y si algún día se cablea al pipeline de impresión (documento en mm) —
// mismo criterio que innerPadding/los layouts *-air, que ya usan % en vez de
// valores fijos. Mismo crema que el resto del "papel" del álbum (PAPER_BG en
// PixiaFlipBook.tsx, el fondo de los layouts hasAir) — no un color nuevo.
const PAGE_MARGIN_PERCENT = 5
const PAGE_MARGIN_BG = '#F9F6F1'

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
export function FacePageView({ face, photosById, side, style = 'sin-margen' }: {
  face: Face
  photosById: Map<string, PhotoAsset>
  /** Si se da, dibuja la sombra de lomo en el borde interior de esta cara. */
  side?: 'left' | 'right'
  /** con-margen dibuja un marco de página alrededor del contenido; default sin-margen (full-bleed, el comportamiento de siempre). */
  style?: AlbumStyle
}) {
  const aspect = usePageAspect()
  let content: ReactNode
  // disableMargin (hoy solo hero-spread, ver registry.ts) es la señal
  // autoritativa de "esto nunca lleva margen de página" — acá nunca se
  // consulta directo porque hero-spread es scope:'spread' y usa
  // HeroSpreadPageView, no FacePageView; queda documentado por si algún día
  // un layout scope:'page' necesita el mismo escape.
  let disableMargin = false
  if (face.kind === 'dedication' && face.dedication) {
    const photo = face.dedication.photoId ? photosById.get(face.dedication.photoId) : undefined
    content = <DedicationCard dedication={face.dedication} photo={photo} />
  } else if (face.isEmpty) {
    content = <div style={{ width: '100%', height: '100%', background: '#F9F6F1' }} />
  } else {
    const schema = getLayoutById(face.layout)
    disableMargin = schema?.disableMargin ?? false
    if (!schema) {
      content = <div style={{ width: '100%', height: '100%', background: '#111' }} />
    } else {
      // Proporción de cada slot en la página real (cuadrada o vertical, ver
      // PageAspectContext). Se usa para el cálculo manual de "cover" en vez de
      // object-fit:cover (ver manualCover.ts — evita que Chromium rasterice
      // la foto al exportar a PDF).
      const slotArs = slotAspectRatios(face.layout, aspect)
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

  // El margen de página envuelve `content` (que puede a su vez tener SU
  // PROPIO aire — innerPadding o hasAir, ver arriba); son dos marcos
  // independientes que se apilan, no se fusionan. Para un layout *-air en
  // con-margen, eso suma el margen de página + el aire propio del layout —
  // visualmente correcto (nunca rompe nada), pero puede verse con MUCHO aire
  // total en layouts que ya eran generosos (ej. trio-portrait-air, ~54% del
  // área ya es aire propio). Vale una revisión visual del equipo, no se
  // intentó compensar acá.
  const showPageMargin = style === 'con-margen' && !disableMargin

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        width: '100%', height: '100%', boxSizing: 'border-box',
        padding: showPageMargin ? `${PAGE_MARGIN_PERCENT}%` : 0,
        background: showPageMargin ? PAGE_MARGIN_BG : undefined,
      }}>
        {content}
      </div>
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
  const aspect = usePageAspect()
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
              // Dos páginas: 2:1 en cuadrado, 3:2 en vertical.
              ...manualCoverStyle(aspectOf(photo.width, photo.height), 2 * aspect, 'center center'),
              userSelect: 'none', pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  )
}
