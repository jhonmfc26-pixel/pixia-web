'use client'

import type { ReactNode } from 'react'
import type { PhotoAsset, AlbumStyle } from '@/core/contracts/AlbumBlueprint'
import type { Face } from '@/core/modules/foldModel/types'
import { getLayoutById } from '@/core/modules/album/layouts/helpers'
import { slotAspectRatios } from '@/core/modules/album/layoutFit'
import { DedicationCard } from '@/core/modules/dedication/DedicationCard'
import { manualCoverStyle, aspectOf } from '@/core/modules/viewer/manualCover'
import PixiaImage from '@/components/ui/PixiaImage'
import { PageAspectContext, usePageAspect } from './PageAspectContext'
import { photoSrc, usePhotoQuality } from './PhotoQualityContext'

// Margen de página del estilo 'con-margen': 5 % del ANCHO de la página
// terminada en los cuatro lados, en el crema del papel del álbum. Lo dibuja
// SIEMPRE PageMargin (abajo), en el visor, el editor y el PDF: lo que se ve
// es lo que se imprime.
export const PAGE_MARGIN_RATIO = 0.05
const PAGE_MARGIN_BG = '#F9F6F1'

/** Geometría de la hoja impresa: la página terminada más el sangrado alrededor. */
export interface PrintPageGeometry {
  trimWidthMm: number
  trimHeightMm: number
  bleedMm: number
}

/**
 * Proporción del área DENTRO del margen. El margen es un 5 % del ancho en
 * los cuatro lados: en una página cuadrada el área sigue siendo cuadrada,
 * pero en la vertical 21×28 queda un poco más angosta (0,73 en vez de 0,75).
 * Los recortes de las fotos se calculan con esta proporción, si no quedarían
 * franjas sin foto.
 */
export function marginContentAspect(trimAspect: number): number {
  return ((1 - 2 * PAGE_MARGIN_RATIO) * trimAspect) / (1 - 2 * PAGE_MARGIN_RATIO * trimAspect)
}

/**
 * Marco de página del estilo 'con-margen'. Fuera de él, `children` ocupa la
 * página entera (a sangre). Adentro, `children` ve la proporción del área
 * útil (PageAspectContext), así los recortes de las fotos son los correctos.
 *
 * - Pantalla (visor, editor): el padding en % se mide sobre el ancho de la
 *   página, igual arriba y abajo.
 * - Impresión (`print`): la hoja trae sangrado alrededor; el margen se mide
 *   sobre la página terminada y se le suma el sangrado, para que después del
 *   corte quede exactamente el mismo 5 % que se vio en pantalla.
 */
export function PageMargin({ show, print, children }: {
  show: boolean
  print?: PrintPageGeometry
  children: ReactNode
}) {
  const screenAspect = usePageAspect()
  if (!show) return <>{children}</>
  const trimAspect = print ? print.trimWidthMm / print.trimHeightMm : screenAspect
  const padding = print
    ? `${(print.bleedMm + PAGE_MARGIN_RATIO * print.trimWidthMm).toFixed(3)}mm`
    : `${PAGE_MARGIN_RATIO * 100}%`
  return (
    <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding, background: PAGE_MARGIN_BG }}>
      <PageAspectContext.Provider value={marginContentAspect(trimAspect)}>
        {children}
      </PageAspectContext.Provider>
    </div>
  )
}

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

/**
 * ¿Esta cara lleva margen de página? Toda cara de un álbum 'con-margen',
 * incluidas dedicatoria y hueco vacío, salvo los layouts con disableMargin
 * (hoy solo hero-spread, que usa HeroSpreadPageView y nunca pasa por acá;
 * queda por si algún día un layout de página necesita el mismo escape).
 */
export function faceHasPageMargin(face: Face, style: AlbumStyle | undefined): boolean {
  if (style !== 'con-margen') return false
  const schema = face.kind !== 'dedication' && !face.isEmpty ? getLayoutById(face.layout) : undefined
  return !(schema?.disableMargin ?? false)
}

/** Cara solo-lectura (una mitad de pliego "paired"). */
export function FacePageView({ face, photosById, side, style = 'sin-margen', print }: {
  face: Face
  photosById: Map<string, PhotoAsset>
  /** Si se da, dibuja la sombra de lomo en el borde interior de esta cara. */
  side?: 'left' | 'right'
  /** con-margen dibuja un marco de página alrededor del contenido; default sin-margen (a sangre). */
  style?: AlbumStyle
  /** Solo en el PDF: medidas de la hoja con sangrado (ver PageMargin). */
  print?: PrintPageGeometry
}) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <PageMargin show={faceHasPageMargin(face, style)} print={print}>
        <FaceContent face={face} photosById={photosById} />
      </PageMargin>
      {side && <GutterEdge side={side} />}
    </div>
  )
}

/** Contenido de la cara (fotos, dedicatoria o hueco), dentro o no del margen. */
function FaceContent({ face, photosById }: { face: Face; photosById: Map<string, PhotoAsset> }) {
  // Proporción del área disponible: la página entera, o lo que queda dentro
  // del margen (PageMargin la ajusta).
  const aspect = usePageAspect()
  const quality = usePhotoQuality()
  if (face.kind === 'dedication' && face.dedication) {
    const photo = face.dedication.photoId ? photosById.get(face.dedication.photoId) : undefined
    return <DedicationCard dedication={face.dedication} photo={photo} />
  }
  if (face.isEmpty) return <div style={{ width: '100%', height: '100%', background: '#F9F6F1' }} />
  const schema = getLayoutById(face.layout)
  if (!schema) return <div style={{ width: '100%', height: '100%', background: '#111' }} />
  // Proporción de cada slot en la página real (cuadrada o vertical, ver
  // PageAspectContext). Se usa para el cálculo manual de "cover" en vez de
  // object-fit:cover (ver manualCover.ts — evita que Chromium rasterice
  // la foto al exportar a PDF).
  const slotArs = slotAspectRatios(face.layout, aspect)
  return (
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
                  src={photoSrc(photo, quality)}
                  fallbackSrc={photo.url}
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
  const quality = usePhotoQuality()
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#E4E0D8' }}>
      <div style={{
        position: 'absolute', top: 0,
        ...(half === 'left' ? { left: 0 } : { right: 0 }),
        width: '200%', height: '100%',
      }}>
        {photo && (
          <PixiaImage
            src={photoSrc(photo, quality)}
            fallbackSrc={photo.url}
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
